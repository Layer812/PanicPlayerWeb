/* Standalone X68000 guest VIDEO bus primitives; no screen or sound claims.
 * Verified against Layer812/X68KTab5 PX68K sources (2026-10-23):
 * x68k/mem_wrap.c, tvram.c, palette.c, crtc.c.
 * Physical addresses: GVRAM 0xc00000..dfffff (0.5MiB backing), TVRAM 0xe00000..e7ffff, CRTC 0xe80000..e803ff,
 * palette 0xe82000..e823ff, VCtrl0/1/2 e82400/e82500/e82600.
 * X68K TEXT VRAM is four 0x20000-byte bitplanes; guest byte address uses
 * PX68K's little-endian-host `^1` transform. Unsupported MMIO fails closed.
 */
#include "pwp_x68k_video_bus.h"
#include <stddef.h>
#define GVBASE 0xc00000u
#define GVLEN 0x200000u
#define TVBASE 0xe00000u
#define TVLEN 0x80000u
#define CRTCBASE 0xe80000u
#define PALBASE 0xe82000u
/* FIX40: HD63450 DMAC channel 3, $E840C0..$E840FF (ADPCM channel).
 * Register offsets, CSR/CER W1C and reset are derived from PX68K
 * x68k/dmac.c and dmac.h. This is a register-only model: no DMA
 * transfer, IRQ or PCM output is synthesized. STR/CNT fail closed.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT (new glue only).
 */
#define DMAC3_BASE 0x00e840c0u
#define DMAC3_END  0x00e84100u
static uint8_t dmac3_regs[0x40u];
static uint32_t dmac3_csr_reads, dmac3_write_count, dmac3_start_rejections;
static int dmac3_valid(unsigned off) {
    switch(off) {
    case 0x00u: case 0x01u:
    case 0x04u: case 0x05u: case 0x06u: case 0x07u:
    case 0x0au: case 0x0bu: case 0x0cu: case 0x0du:
    case 0x0eu: case 0x0fu:
    case 0x14u: case 0x15u: case 0x16u: case 0x17u:
    case 0x1au: case 0x1bu: case 0x1cu: case 0x1du:
    case 0x1eu: case 0x1fu:
    case 0x25u: case 0x27u: case 0x29u: case 0x2du:
    case 0x31u: case 0x39u: case 0x3fu: return 1;
    default: return 0; /* Reserved gaps are not blanket-emulated. */
    }
}
static int dmac3_write(unsigned off,uint8_t value) {
    if (!dmac3_valid(off))return 0;
    if (off==0x07u) {
        /* CCR STR bit7 requests transfer; CNT bit6 requests chaining.
         * Neither is implementable without real DMA+ADPCM scheduling. */
        if (value&0xc0u) {++dmac3_start_rejections;return 0;}
        /* Bit4 SAB is a command and cannot latch in an idle CCR. */
        dmac3_regs[off]=(uint8_t)(value&0x6fu);
    } else if(off==0x00u) {
        /* PX68K DMA_Write case 0: CSR W1C, preserve bit0/ACT bit3. */
        dmac3_regs[off]&=(uint8_t)((uint8_t)~value | 0x09u);
    } else if(off==0x01u) {
        dmac3_regs[off]&=(uint8_t)~value; /* CER W1C */
    } else if(off==0x0cu || off==0x14u || off==0x1cu) {
        /* MAR/DAR/BAR are 24-bit; MSB write is ignored by PX68K. */
    } else {
        dmac3_regs[off]=value;
    }
    ++dmac3_write_count;
    return 1;
}
uint32_t pwp_bus_dmac3_csr_reads(void){return dmac3_csr_reads;}
uint32_t pwp_bus_dmac3_write_count(void){return dmac3_write_count;}
uint32_t pwp_bus_dmac3_start_rejections(void){return dmac3_start_rejections;}
#ifdef PWP_TEST_STAGE
void pwp_bus_test_dmac3_status(uint8_t csr,uint8_t cer){
    dmac3_regs[0]=csr;dmac3_regs[1]=cer;
}
#endif
/* X68000 system port #4 ($E8E007): keyboard / NMI reset / dot clock.
 * MMIO is byte-wide at the odd address. Refer to MAME x68k sysport_r/w
 * and X68k/IOMAP. Reading bit3 reports a connected keyboard, whereas
 * writing bit3 controls keyboard transmission. They are NOT readback. */
#define SYSPORT4_ADDRESS 0x00e8e007u
static uint8_t sysport4_write_control;
static uint8_t gvram[0x80000u];
static uint8_t tvram[TVLEN];
static uint8_t crtc[48];
/* FIX15: guest CRTC register-change observer, not a raster side-effect. */
static uint32_t crtc_changed_writes;
static uint8_t pal[1024];
static uint8_t vc[3][2];
/* CYNTHIA sprite/BG hardware: 128 sprite records, 256x128-byte PCG,
 * two 64x64 BG tile maps and a small scroll/control register bank. */
#define SPR_ATTR_BASE 0x00eb0000u
#define SPR_ATTR_END  0x00eb0400u
#define SPR_CTRL_BASE 0x00eb0800u
#define SPR_CTRL_END  0x00eb0812u
#define SPR_PCG_BASE  0x00eb8000u
#define SPR_PCG_END   0x00ec0000u
static uint8_t sprite_attrs[SPR_ATTR_END-SPR_ATTR_BASE];
static uint8_t sprite_ctrl[SPR_CTRL_END-SPR_CTRL_BASE];
static uint8_t sprite_pcg_bg[SPR_PCG_END-SPR_PCG_BASE];
static uint8_t sprite_initialized,sprite_display_enabled;
static uint32_t sprite_initializations,sprite_enables;
/* Read-only evidence of actual guest MMIO transfers. */
static uint32_t sprite_attr_writes,sprite_pcg_writes,sprite_palette_writes;
static uint32_t writes;
/* Real pixel-memory mutations; CRTC/palette programming alone is not a frame. */
static uint32_t pixel_mutations;
/* IOCS graphics reset is separate from movie-origin GVRAM writes. */
static uint32_t graphics_clears;
static uint8_t graphics_display_enabled;
static uint8_t graphics_access_page;
/* FIX20 adds CPU-side V-DISP edge scheduling for the *actual* $46 handler,
 * while retaining the original two guest-visible MC68901 control registers.
 * Other MFP timers, USART and sources are still NOT emulated.
 * R16 FIX5: only the TWO MFP interrupt-control registers actually read at
 * PANIC.X $010048/$01004E are wired here. Their initial values are copied
 * from X68KTab5 components/px68k/x68k/mfp.c MFP_Init() (IERB=IMRB=0x3e).
 * These are REAL register values, NOT hard-coded results for PANIC.X.
 * MFP clocks, USART, IRQs and other MC68901 registers are NOT modeled and
 * remain fail-closed; this is not an MFP emulator. */
#define MFP_GPIP_ADDRESS 0x00e88001u
#define MFP_IERB_ADDRESS 0x00e88009u
#define MFP_IPRB_ADDRESS 0x00e8800du
#define MFP_ISRB_ADDRESS 0x00e88011u
#define MFP_IMRB_ADDRESS 0x00e88015u
/* MC68901 V-DISP source 6: IPRB bit6 latches an IERB-enabled event.
 * Masked events remain pending until IMRB unmasks them.  This covers only
 * the observed V-DISP source; other interrupts remain unsupported. */
static uint8_t mfp_iprb, mfp_isrb;
static uint8_t mfp_ierb, mfp_imrb;
static uint32_t mfp_read_ierb, mfp_read_imrb;
static uint32_t mfp_last_read;
static uint8_t mfp_gpip4_active;
static uint32_t mfp_gpip_reads;


static void bus_clear(void *ptr,size_t n) {
    volatile uint8_t *p=(volatile uint8_t*)ptr;
    for(size_t i=0;i<n;i++)p[i]=0;
}
void pwp_bus_reset(void) {
    bus_clear(dmac3_regs,sizeof(dmac3_regs));
    dmac3_csr_reads=dmac3_write_count=dmac3_start_rejections=0;
    bus_clear(gvram,sizeof(gvram));
    bus_clear(tvram,sizeof(tvram));
    bus_clear(crtc,sizeof(crtc));
    bus_clear(pal,sizeof(pal));
    bus_clear(vc,sizeof(vc));
    bus_clear(sprite_attrs,sizeof(sprite_attrs));
    bus_clear(sprite_ctrl,sizeof(sprite_ctrl));
    bus_clear(sprite_pcg_bg,sizeof(sprite_pcg_bg));
    sprite_initialized=sprite_display_enabled=0;
    sprite_initializations=sprite_enables=0;
    sprite_attr_writes=sprite_pcg_writes=sprite_palette_writes=0;
    writes=0;
    crtc_changed_writes=0;
    pixel_mutations=0;
    graphics_clears=0;graphics_display_enabled=0;graphics_access_page=0;
    mfp_ierb=0x3eu; mfp_imrb=0x3eu;
    mfp_iprb=0u; mfp_isrb=0u;
    mfp_read_ierb=mfp_read_imrb=mfp_last_read=0;
    mfp_gpip_reads=0;
    mfp_gpip4_active=1;  /* Power-on: active display phase. */
    sysport4_write_control=0u; /* no guest keyboard transmit enabled */
}
/* _CRTMOD(10): 512x512 backing, 256x256 visible, 256 color, 2-page,
 * refresh 31kHz. IOCS CRTMOD clears only TEXT pages 0/1, not GVRAM.
 * It also disables graphics until _G_CLR_ON; this standalone bus does
 * not yet simulate scan timing, palette reset, or IOCS graphics display.
 * The 8-bit palette indexing of the existing GVRAM decoder is selected by
 * CRTC register R20 low bits = 1 (graphic_mode()==2 here). */
int pwp_bus_apply_crtmod10(void) {
    /* Clear the two text planes as documented, not graphic pixels. */
    bus_clear(tvram,0x40000u);
    const uint8_t newmode=(uint8_t)((crtc[0x28]&0xf0u)|1u);
    if(crtc[0x28]!=newmode)++crtc_changed_writes;
    crtc[0x28]=newmode;
    /* IOCS _CRTMOD(10) sets the 512-dot 256-colour format and normal
     * physical nibble ordering for the 2 logical 8-bit GVRAM pages.
     * Our standalone IOCS path does not execute the X68000 ROM routine,
     * so that ROM-owned VC setup must be represented in the device model.
     * R1=0x00e4 encodes physical [0,1,2,3], not repeated page 0.
     * Guest MMIO writes to VC R1 continue to override these defaults.
     * This does NOT assume a PANIC.X page flip or invent movie frames. */
    vc[0][0]=0u; vc[0][1]=1u;   /* video-controller colour mode = 256 */
    vc[1][0]=0u; vc[1][1]=0xe4u;/* physical nibble order [0,1,2,3] */
    /* Video controller screen-enable remains zero until a separate gate. */
    vc[2][0]=vc[2][1]=0;
    graphics_display_enabled=0;
    /* Changing display mode invalidates prior sprite initialization. */
    sprite_initialized=sprite_display_enabled=0;
    vc[2][1]&=(uint8_t)~0x40u;
    return 1;
}
/* IOCS $90 _G_CLR_ON: no parameters.  Mode 10 has 256 colors and
 * two packed GVRAM pages.  The real ROM clears the graphics screen, resets
 * its palette/access page and enables G0.  This bounded device subset clears
 * both packed pages; palette *contents* use a zeroed baseline rather than
 * claiming the ROM's undocumented standard color table. Palette-dependent
 * movie imagery remains unverified until guest-supplied colors are observed.
 * The clear is not counted as animation-derived pixel mutations. */
int pwp_bus_g_clr_on10(void) {
    if ((crtc[0x28] & 0x0fu)!=1u) return 0;
    bus_clear(gvram,sizeof(gvram));
    bus_clear(pal,0x200u); /* graphic palette registers only */
    graphics_access_page=0u;
    graphics_display_enabled=1u;
    vc[2][0]=0;vc[2][1]=1u; /* VC R2 G0 on, no false sprite/text enable */
    ++graphics_clears;
    return 1;
}
/* IOCS _SP_INIT: mode 10 supports CYNTHIA; reset the backing memory and
 * display flags. Do not overwrite graphics palette ($E82000..E821FF),
 * GVRAM, or text video layers. Sprite palettes are the 256 entries in the
 * $E82200-$E823FF region and start blank in this partial IOCS model. */
int pwp_bus_sp_init10(void) {
    if ((crtc[0x28]&0x0fu)!=1u) return 0;
    bus_clear(sprite_attrs,sizeof sprite_attrs);
    bus_clear(sprite_ctrl,sizeof sprite_ctrl);
    bus_clear(sprite_pcg_bg,sizeof sprite_pcg_bg);
    bus_clear(pal+0x200u,0x200u);
    sprite_initialized=1;
    sprite_display_enabled=0;
    vc[2][1]&=(uint8_t)~0x40u;
    ++sprite_initializations;
    return 1;
}
int pwp_bus_sp_on10(void) {
    if((crtc[0x28]&0x0fu)!=1u || !sprite_initialized)return 0;
    /* FIX35: _SP_ON enables both the VC sprite layer (SON, R2 bit6)
     * and CYNTHIA's own DISP gate ($EB0808 word bit9, byte +0 bit1).
     * FIX34 set SON alone, yet its compositor required both, leaving every
     * IOCS-only sprite invisible. Preserve BG0/BG1 enable and PCG bank bits. */
    sprite_ctrl[8]|=0x02u;
    sprite_display_enabled=1;
    vc[2][1]|=0x40u;
    ++sprite_enables;
    return 1;
}
/* _SP_OFF ($C2) switches off both independent sprite gates, retaining
 * attributes, patterns, BG maps and palette for a later _SP_ON. */
int pwp_bus_sp_off10(void) {
    if((crtc[0x28]&0x0fu)!=1u || !sprite_initialized)return 0;
    sprite_ctrl[8]&=(uint8_t)~0x02u;
    sprite_display_enabled=0;
    vc[2][1]&=(uint8_t)~0x40u;
    return 1;
}
uint32_t pwp_bus_cynthia_disp_gate(void){return (sprite_ctrl[8]&2u)?1u:0u;}
uint32_t pwp_bus_cynthia_attr_writes(void){return sprite_attr_writes;}
uint32_t pwp_bus_cynthia_pcg_writes(void){return sprite_pcg_writes;}
uint32_t pwp_bus_cynthia_palette_writes(void){return sprite_palette_writes;}
uint32_t pwp_bus_cynthia_raw_sprite_count(void){
    uint32_t count=0;
    for(unsigned i=0;i<128u;i++)count+=(sprite_attrs[i*8u+7u]&3u)!=0u;
    return count;
}
uint32_t pwp_bus_sprite_initialized(void){return sprite_initialized;}
uint32_t pwp_bus_sprite_display_enabled(void){return sprite_display_enabled;}
uint32_t pwp_bus_sprite_initializations(void){return sprite_initializations;}
uint32_t pwp_bus_sprite_enables(void){return sprite_enables;}
/* FIX34: independently decoded CYNTHIA sprite/BG line.  All source bytes
 * are written by the actual guest through $EBxxxx MMIO. These functions do
 * not mutate guest registers or palettes, and they never synthesize a PAN
 * frame.  The 16-pixel border and 16x16 PCG quadrant arrangement match the
 * X68000 hardware and the reference PX68K BG/sprite implementation.
 */
static uint16_t cy_word_be(const uint8_t *p, uint32_t o){
    return (uint16_t)(((uint16_t)p[o]<<8) | p[o+1u]);
}
static uint8_t cy_pattern_pixel(uint8_t id, unsigned size,
                                unsigned x,unsigned y){
    uint32_t offset;
    if(size==8u){
        offset=(uint32_t)id*32u+(y&7u)*4u+((x&7u)>>1);
    }else{
        /* 16x16: each half-row is four packed bytes; left/right 8x16
         * segments occupy consecutive 64-byte blocks of the 128-byte tile. */
        offset=(uint32_t)id*128u+((x&8u)?64u:0u)+(y&15u)*4u+((x&7u)>>1);
    }
    const uint8_t packed=sprite_pcg_bg[offset];
    return (uint8_t)(((x&1u)?packed:(packed>>4))&15u);
}
static void cy_sprites_priority(uint32_t y,uint32_t width,uint8_t *dst,unsigned priority){
    /* Reverse sprite number, so that smaller sprite number has precedence
     * at the same priority, as in PX68K's Sprite_PrepareLine/DrawPrepared. */
    for(int n=127;n>=0;--n){
        const uint32_t base=(uint32_t)n*8u;
        if((sprite_attrs[base+7u]&3u)!=priority)continue;
        const uint16_t posx=cy_word_be(sprite_attrs,base);
        const uint16_t posy=cy_word_be(sprite_attrs,base+2u);
        const uint16_t control=cy_word_be(sprite_attrs,base+4u);
        const int32_t sx=(int32_t)(posx&1023u)-16;
        const int32_t sy=(int32_t)(posy&1023u)-16;
        const int32_t srcy=(int32_t)y-sy;
        if(srcy<0||srcy>=16)continue;
        const unsigned py=(control&0x8000u)?(unsigned)(15-srcy):(unsigned)srcy;
        const uint8_t tile=(uint8_t)control;
        const uint8_t palette=(uint8_t)((control>>4)&0xf0u);
        for(unsigned xx=0;xx<16u;xx++){
            int32_t outx=sx+(int32_t)xx;
            if(outx<0||outx>=(int32_t)width)continue;
            const unsigned px=(control&0x4000u)?(15u-xx):xx;
            const uint8_t low=cy_pattern_pixel(tile,16u,px,py);
            if(low)dst[outx]=(uint8_t)(palette|low);
        }
    }
}
static void cy_bg_plane(uint32_t y,uint32_t width,uint8_t *dst,unsigned plane){
    const uint8_t cfg=sprite_ctrl[9];
    if(plane==0u?!(cfg&1u):!(cfg&8u))return;
    const unsigned size=(sprite_ctrl[0x11]&3u)?16u:8u;
    /* BG1 only exists in the 8x8 configuration in the upstream renderer. */
    if(plane==1u && size!=8u)return;
    const uint16_t scrollx=cy_word_be(sprite_ctrl,plane?4u:0u);
    const uint16_t scrolly=cy_word_be(sprite_ctrl,plane?6u:2u);
    const uint32_t map_base=plane?((cfg&0x30u)?0x6000u:0x4000u)
                                 :((cfg&0x06u)?0x6000u:0x4000u);
    const uint32_t mask=(size==16u)?1023u:511u;
    const uint32_t yy=(y+(uint32_t)scrolly)&mask;
    const unsigned ty=(unsigned)(yy/(uint32_t)size);
    const unsigned py=(unsigned)(yy%(uint32_t)size);
    for(uint32_t x=0;x<width;x++){
        const uint32_t xx=(x+(uint32_t)scrollx)&mask;
        const unsigned tx=(unsigned)(xx/(uint32_t)size);
        const uint32_t mp=map_base+(ty*64u+tx)*2u;
        if(mp+1u>=SPR_PCG_END-SPR_PCG_BASE)continue;
        const uint8_t attr=sprite_pcg_bg[mp];
        const uint8_t id=sprite_pcg_bg[mp+1u];
        const unsigned px=(attr&0x40u)?(size-1u-(xx%(uint32_t)size))
                                          :(xx%(uint32_t)size);
        const unsigned ry=(attr&0x80u)?(size-1u-py):py;
        const uint8_t low=cy_pattern_pixel(id,size,px,ry);
        if(low)dst[x]=(uint8_t)(((attr<<4)&0xf0u)|low);
    }
}
uint32_t pwp_bus_cynthia_active_sprites(void){
    if(!sprite_display_enabled || !(sprite_ctrl[8]&2u) ||
        (sprite_ctrl[0x11]&2u))return 0u;
    uint32_t count=0;
    for(unsigned i=0;i<128u;i++)count+=((sprite_attrs[i*8u+7u]&3u)!=0u);
    return count;
}
void pwp_bus_cynthia_line(uint32_t y,uint32_t width,uint8_t *out){
    if(!out || !width || width>512u)return;
    for(uint32_t i=0;i<width;i++)out[i]=0u;
    /* Both VC's SON and CYNTHIA's DISP are required to show sprites/BG. */
    if(!sprite_display_enabled || !(sprite_ctrl[8]&2u) ||
       (sprite_ctrl[0x11]&2u))return;
    cy_sprites_priority(y,width,out,1u);
    cy_bg_plane(y,width,out,1u);
    cy_sprites_priority(y,width,out,2u);
    cy_bg_plane(y,width,out,0u);
    cy_sprites_priority(y,width,out,3u);
}
uint32_t pwp_bus_graphics_display_enabled(void){return graphics_display_enabled;}
uint32_t pwp_bus_graphics_clear_count(void){return graphics_clears;}
uint32_t pwp_bus_graphics_page(void){return graphics_access_page;}
int pwp_bus_access8(uint32_t addr) {
    if(addr>=DMAC3_BASE && addr<DMAC3_END)
        return dmac3_valid((unsigned)(addr-DMAC3_BASE));
    if(addr==SYSPORT4_ADDRESS)return 1;
    if(addr==MFP_GPIP_ADDRESS || addr==MFP_IERB_ADDRESS ||
       addr==MFP_IPRB_ADDRESS || addr==MFP_ISRB_ADDRESS ||
       addr==MFP_IMRB_ADDRESS)return 1;
    if((addr>=SPR_ATTR_BASE && addr<SPR_ATTR_END) ||
       (addr>=SPR_CTRL_BASE && addr<SPR_CTRL_END) ||
       (addr>=SPR_PCG_BASE && addr<SPR_PCG_END))return 1;
    /* Reject high bits: real machine uses 24-bit physical addressing, but
     * alias wrapping must be modeled explicitly by the CPU host later. */
    if(addr>=GVBASE && addr<GVBASE+GVLEN)return 1;
    if(addr>=TVBASE && addr<TVBASE+TVLEN)return 1;
    if(addr>=CRTCBASE && addr<0xe80400u)return 1;
    if(addr>=PALBASE && addr<0xe82400u)return 1;
    if(addr>=0xe82400u && addr<0xe82700u)return 1;
    return 0;
}
/* CRTC register aliases >= 0x30 are not implemented in the source bus.
 * Preflight writes as well as reads; an invalid final byte must not
 * commit the earlier bytes of a word or longword write. */
int pwp_bus_writable8(uint32_t addr) {
    if(addr>=DMAC3_BASE && addr<DMAC3_END)
        return dmac3_valid((unsigned)(addr-DMAC3_BASE));
    if (!pwp_bus_access8(addr) || addr == MFP_GPIP_ADDRESS) return 0;
    if (addr >= CRTCBASE && addr < 0xe80400u) return (addr & 0x3fu) < 0x30u;
    return 1;
}
/* PX68K GVRAM_Read/GVRAM_Write addressing modes. All writes are
 * byte-oriented as on X68000; even bytes in 16-color mode read as zero. */
static unsigned graphic_mode(void){
  return (crtc[0x28]&8u)?4u:(crtc[0x28]&4u)?0u:((crtc[0x28]&3u)+1u);
}
static uint8_t gvread(uint32_t a) {
  const unsigned mode=graphic_mode();
  a&=0x1fffffu;
  if(mode==0u){
    if(!(a&1u))return 0;
    unsigned page=((a&0x100000u)?2u:0u)+((a&0x400u)?1u:0u);
    unsigned index=((a>>1)&0x7fc00u)|(a&0x3ffu);
    uint8_t value=gvram[index^(page<2u?1u:0u)];
    return (page&1u)?(value>>4):(value&15u);
  }
  if(mode==1u){
    if(!(a&1u))return 0;
    const unsigned page=a>>19;
    const unsigned off=a&0x7ffffu;
    const uint8_t value=gvram[off^(page<2u?1u:0u)];
    return (page&1u)?(value>>4):(value&15u);
  }
  if(mode==2u || mode==3u){
    if(!(a&1u) || a>=0x100000u)return 0;
    return gvram[(a&0x7ffffu)^((a<0x80000u)?1u:0u)];
  }
  if(mode==4u && a<0x80000u)return gvram[a^1u];
  return 0;
}
static void gvwrite(uint32_t a, uint8_t data) {
  const unsigned mode=graphic_mode();
  a&=0x1fffffu;
  if(mode==0u){
    if(!(a&1u))return;
    unsigned page=((a&0x100000u)?2u:0u)+((a&0x400u)?1u:0u);
    unsigned index=((a&0xff800u)>>1)+(a&0x3ffu);
    uint8_t *p=&gvram[index^(page<2u?1u:0u)];
    *p=(uint8_t)((page&1u)?((*p&0x0fu)|((data&15u)<<4)):(*p&0xf0u)|(data&15u));
    return;
  }
  if(mode==1u){
    if(!(a&1u))return;
    unsigned page=a>>19;
    uint8_t *p=&gvram[(a&0x7ffffu)^(page<2u?1u:0u)];
    *p=(uint8_t)((page&1u)?((*p&0x0fu)|((data&15u)<<4)):(*p&0xf0u)|(data&15u));
    return;
  }
  if(mode==2u || mode==3u){
    if((a&1u) && a<0x100000u)gvram[(a&0x7ffffu)^((a<0x80000u)?1u:0u)]=data;
    return;
  }
  if(mode==4u && a<0x80000u)gvram[a^1u]=data;
}
int pwp_bus_read8(uint32_t addr, uint8_t *out) {
    if(!out || !pwp_bus_access8(addr))return 0;
    if(addr>=DMAC3_BASE && addr<DMAC3_END) {
        const unsigned off=(unsigned)(addr-DMAC3_BASE);
        *out=dmac3_regs[off];
        if(off==0u)++dmac3_csr_reads;
        return 1;
    }
    if(addr==SYSPORT4_ADDRESS){
        /* The guest can query keyboard presence independently of KEY CTRL.
         * No NMI / dot-clock side effect arises from this read. */
        *out=0x08u;
        return 1;
    }
    if(addr==MFP_GPIP_ADDRESS){
        /* PX68K GetGPIP(): bit5=1, bits0/1=1, bit6=1 outside raster
         * compare; H-SYNC bit7 held high in this V-DISP-only subset.
         * Only bit4 carries time-accurate behavior. Other GPIP sources
         * are deliberately not presented as fully implemented. */
        *out=(uint8_t)(0xe3u | (mfp_gpip4_active ? 0x10u : 0u));
        ++mfp_gpip_reads; mfp_last_read=addr;
        return 1;
    }
    if(addr==MFP_IERB_ADDRESS){*out=mfp_ierb;mfp_read_ierb++;mfp_last_read=addr;return 1;}
    if(addr==MFP_IPRB_ADDRESS){*out=mfp_iprb;return 1;}
    if(addr==MFP_ISRB_ADDRESS){*out=mfp_isrb;return 1;}
    if(addr==MFP_IMRB_ADDRESS){*out=mfp_imrb;mfp_read_imrb++;mfp_last_read=addr;return 1;}
    if(addr>=SPR_ATTR_BASE && addr<SPR_ATTR_END){*out=sprite_attrs[addr-SPR_ATTR_BASE];return 1;}
    if(addr>=SPR_CTRL_BASE && addr<SPR_CTRL_END){*out=sprite_ctrl[addr-SPR_CTRL_BASE];return 1;}
    if(addr>=SPR_PCG_BASE && addr<SPR_PCG_END){*out=sprite_pcg_bg[addr-SPR_PCG_BASE];return 1;}
    if(addr<GVBASE+GVLEN){*out=gvread(addr-GVBASE);return 1;}
    if(addr<TVBASE+TVLEN){*out=tvram[(addr-TVBASE)^1u];return 1;}
    if(addr<0xe80400u){
        unsigned r=addr&0x3fu;
        *out=(r>=0x28u && r<=0x2bu)?crtc[r]:0;
        return 1;
    }
    if(addr<0xe82400u){*out=pal[addr-PALBASE];return 1;}
    *out=vc[(addr-0xe82400u)>>8][addr&1u];return 1;
}
static void tvwrite(uint32_t off,uint8_t value) {
    if (tvram[off] != value) {tvram[off]=value;pixel_mutations++;}
}
static void tvmask(uint32_t off,uint8_t value) {
    /* PX68K tvram.c indexes text-mask registers by (physical_addr^1)&1. */
    uint8_t mask=crtc[0x2eu + ((off^1u)&1u)];
    tvwrite(off,(uint8_t)((tvram[off]&mask)|(value&(uint8_t)~mask)));
}
int pwp_bus_write8(uint32_t addr,uint8_t value) {
    if(!pwp_bus_writable8(addr))return 0;
    if(addr>=DMAC3_BASE && addr<DMAC3_END)
        return dmac3_write((unsigned)(addr-DMAC3_BASE),value);
    if(addr==SYSPORT4_ADDRESS){
        /* Preserve documented control fields (KEY CTRL, NMI RESET, HRL).
         * No guest NMI input or variable dot-clock peripheral is modeled,
         * so do not fabricate a CPU interrupt / video timing change. */
        sysport4_write_control=(uint8_t)(value&0x0eu);
        return 1;
    }
    /* Register readback is mutable, like X68KTab5 MFP_Write(). Timer/IRQ
     * delivery remains unsupported; writes do not fabricate interrupts. */
    if(addr==MFP_IERB_ADDRESS){
        mfp_ierb=value;
        mfp_iprb &= (uint8_t)(value | 0xbfu); /* disabled V-DISP drops IPRB6 */
        return 1;
    }
    if(addr==MFP_IPRB_ADDRESS){mfp_iprb &= (uint8_t)(value | 0xbfu);return 1;}
    if(addr==MFP_ISRB_ADDRESS){mfp_isrb &= (uint8_t)(value | 0xbfu);return 1;}
    if(addr==MFP_IMRB_ADDRESS){mfp_imrb=value;return 1;}
    if(addr>=SPR_ATTR_BASE && addr<SPR_ATTR_END){sprite_attrs[addr-SPR_ATTR_BASE]=value;writes++;sprite_attr_writes++;return 1;}
    if(addr>=SPR_CTRL_BASE && addr<SPR_CTRL_END){sprite_ctrl[addr-SPR_CTRL_BASE]=value;writes++;return 1;}
    if(addr>=SPR_PCG_BASE && addr<SPR_PCG_END){sprite_pcg_bg[addr-SPR_PCG_BASE]=value;writes++;sprite_pcg_writes++;return 1;}
    if(addr<GVBASE+GVLEN){
        const uint32_t off=addr-GVBASE;
        const uint8_t before=gvread(off);
        gvwrite(off,value);
        if (gvread(off)!=before) pixel_mutations++;
        writes++;return 1;
    }
    if(addr<TVBASE+TVLEN){
        uint32_t off=(addr-TVBASE)^1u;
        uint8_t concurrent=crtc[0x2a]&1u;
        uint8_t masked=crtc[0x2a]&2u;
        if(concurrent){
            off&=0x1ffffu;
            for(uint32_t p=0;p<4;p++){
                if(crtc[0x2b]&(0x10u<<p)){
                    uint32_t dest=off+p*0x20000u;
                    if(masked)tvmask(dest,value);else tvwrite(dest,value);
                }
            }
        } else if(masked)tvmask(off,value);else tvwrite(off,value);
        writes++;return 1;
    }
    if(addr<0xe80400u){
        const uint32_t reg=addr&0x3fu;
        if(reg>=0x30u)return 0;
        if(crtc[reg]!=value)++crtc_changed_writes;
        crtc[reg]=value;writes++;return 1;
    }
    if(addr<0xe82400u){pal[addr-PALBASE]=value;writes++;if(addr>=0xe82200u)sprite_palette_writes++;return 1;}
    vc[(addr-0xe82400u)>>8][addr&1u]=value;
    if(addr==0x00e82601u) sprite_display_enabled=(uint8_t)((value&0x40u)!=0u);
    writes++;return 1;
}
/* Raw four-plane TEXT index (no scrolling, BG/sprites, or final composition).
 * The index is genuine 4-bit pixel state; it is not yet a screen frame. */
uint8_t pwp_bus_text_index(uint32_t x,uint32_t y) {
    if(x>=1024u || y>=1024u)return 0;
    uint32_t base=(((y<<7)+(x>>3))^1u);
    uint8_t bit=(uint8_t)(0x80u>>(x&7u));
    return (uint8_t)(((tvram[base]&bit)?1u:0u)|
        ((tvram[base+0x20000u]&bit)?2u:0u)|
        ((tvram[base+0x40000u]&bit)?4u:0u)|
        ((tvram[base+0x60000u]&bit)?8u:0u));
}
uint16_t pwp_bus_palette_word(uint32_t index,int text_palette) {
    if(index>=256u)return 0;
    uint32_t base=(text_palette?0x200u:0u)+index*2u;
    return (uint16_t)(((uint16_t)pal[base]<<8)|pal[base+1]);
}
uint32_t pwp_bus_sysport4_control(void){return sysport4_write_control;}
uint32_t pwp_bus_video_writes(void){return writes;}
uint32_t pwp_bus_pixel_mutations(void){return pixel_mutations;}
uint8_t pwp_bus_crtc_register(uint32_t reg) {return reg<48u?crtc[reg]:0;}
uint32_t pwp_bus_crtc_changed_writes(void){return crtc_changed_writes;}
uint32_t pwp_bus_vctrl_r2(void){return ((uint32_t)vc[2][0]<<8)|vc[2][1];}
uint32_t pwp_bus_vctrl_r1(void){return ((uint32_t)vc[1][0]<<8)|vc[1][1];}

uint16_t pwp_bus_graphic_word(uint32_t x,uint32_t y){
    if(x>=512u || y>=512u)return 0;
    uint32_t off=(y<<10)+(x<<1);
    return (uint16_t)(((uint16_t)gvram[off^1u]<<8)|gvram[off]);
}

/* R16 FIX5 guest-visible register-observation counters for real-CPU gates. */
void pwp_bus_mfp_set_vdisp_active(int active){mfp_gpip4_active=(uint8_t)!!active;}
uint32_t pwp_bus_mfp_gpip4_reads(void){return mfp_gpip_reads;}
uint32_t pwp_bus_mfp_gpip4_level(void){return mfp_gpip4_active;}
uint32_t pwp_bus_mfp_vdisp_enabled(void){return (mfp_ierb&0x40u)&&(mfp_imrb&0x40u);}
void pwp_bus_mfp_vdisp_pulse(void){
    if(mfp_ierb & 0x40u)mfp_iprb |= 0x40u;
}
uint32_t pwp_bus_mfp_vdisp_irq_ready(void){
    return ((mfp_ierb & mfp_imrb & mfp_iprb)&0x40u) && !(mfp_isrb&0x40u);
}
void pwp_bus_mfp_vdisp_ack(void){mfp_iprb &= (uint8_t)~0x40u;}
uint32_t pwp_bus_mfp_vdisp_latched(void){return (mfp_iprb&0x40u)!=0u;}
uint32_t pwp_bus_mfp_ierb_reads(void){return mfp_read_ierb;}
uint32_t pwp_bus_mfp_imrb_reads(void){return mfp_read_imrb;}
uint32_t pwp_bus_mfp_last_read_address(void){return mfp_last_read;}
