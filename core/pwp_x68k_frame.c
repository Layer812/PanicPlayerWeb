/* Panic Player Web R8 -- true guest VRAM -> RGBA pixels, partial X68K raster.
 * This renderer consumes the real physical GVRAM/TVRAM and palette registers
 * of pwp_x68k_video_bus.c. No PAN decoding or fake video playback involved.
 * Scope: 512px wide 16/256/65536-color graphic pages with independent graphic
 * scroll, optionally opaque nonzero four-plane TEXT overlay + TEXT scroll.
 * Not yet implemented: 1024-dot mode, full VC priority registers, scanline
 * interrupts, bitplane-specific dirty/copy timing, external video or audio.
 */
#include "pwp_x68k_frame.h"
#include "pwp_x68k_video_bus.h"
#include <stdint.h>
#define PWP_MAX_WIDTH 512u
#define PWP_MAX_HEIGHT 512u
#define PWP_FRAME_CAP (PWP_MAX_WIDTH*PWP_MAX_HEIGHT*4u)
static uint8_t frame_rgba[PWP_FRAME_CAP];
static uint32_t frame_bytes;
/* FIX36: last complete frame's actual layer contribution. These counters
 * are diagnostics only; they do not change guest device registers. */
static uint32_t gfx_nonzero, text_nonzero, gfx_text_overlap;
static uint32_t gfx_palette_zero, gfx_visible_pixels, text_visible_pixels;
uint32_t pwp_frame_gfx_nonzero(void){return gfx_nonzero;}
uint32_t pwp_frame_text_nonzero(void){return text_nonzero;}
uint32_t pwp_frame_gfx_text_overlap(void){return gfx_text_overlap;}
uint32_t pwp_frame_gfx_palette_zero(void){return gfx_palette_zero;}
uint32_t pwp_frame_gfx_visible_pixels(void){return gfx_visible_pixels;}
uint32_t pwp_frame_text_visible_pixels(void){return text_visible_pixels;}

/* FIX27: guest-palette-verified rendering-only correction for missing
 * graphics palette index 0. Disabled by default. The browser verifies
 * actual guest palette entries 1..15 against the selected PAN packet
 * before enabling. The guest bus and guest MMIO always remain unchanged. */
static uint16_t palette0_evidence_color;
static uint8_t palette0_evidence_enabled;
void pwp_frame_set_palette0_evidence(uint32_t enable,uint32_t word){
  palette0_evidence_enabled=(uint8_t)(enable && word<=0xffffu);
  palette0_evidence_color=(uint16_t)word;
}


static uint16_t reg16(unsigned r) {
  return (uint16_t)(((uint16_t)pwp_bus_crtc_register(r)<<8)|
                     pwp_bus_crtc_register(r+1u));
}
static uint32_t scroll_x(uint32_t page){return (uint32_t)reg16(0x18u+4u*page)&511u;}
static uint32_t scroll_y(uint32_t page){return (uint32_t)reg16(0x1au+4u*page)&511u;}
static uint8_t scaled6(uint32_t value){return (uint8_t)((value*255u+31u)/63u);}
/* GRB word: G[15:11], R[10:6], B[5:1], common intensity in bit 0.
 * Build a 6-bit channel by appending the intensity bit; color 0 stays black.
 * Canvas wants RGBA byte order, not little-endian host uint32 ordering. */
uint32_t pwp_frame_grb8888(uint16_t v){
  uint32_t it=v&1u;
  uint32_t r=scaled6((((uint32_t)v>>6)&31u)*2u+it);
  uint32_t g=scaled6((((uint32_t)v>>11)&31u)*2u+it);
  uint32_t b=scaled6((((uint32_t)v>>1)&31u)*2u+it);
  return (r<<24)|(g<<16)|(b<<8)|255u;
}
uintptr_t pwp_frame_pointer(void){return (uintptr_t)frame_rgba;}
uint32_t pwp_frame_size(void){return frame_bytes;}

int pwp_frame_render(uint32_t width,uint32_t height,
                     uint32_t graphic_page,uint32_t overlay_text){
  /* Reject dimensions and incomplete/unsupported raster modes before modifying
   * any buffer bytes; callers cannot accidentally display previous pixels. */
  frame_bytes=0;
  if(!width||!height||width>PWP_MAX_WIDTH||height>PWP_MAX_HEIGHT||
     graphic_page>3u||overlay_text>1u)return 0;
  const uint8_t cm=pwp_bus_crtc_register(0x28u);
  const uint32_t mode=(cm&8u)?4u:((cm&4u)?0u:((uint32_t)(cm&3u)+1u));
  if(mode==0u||mode==3u)return 0;
  if(mode==2u && graphic_page>1u)return 0;
  if(mode==4u && graphic_page!=0u)return 0;
  const uint32_t gx=scroll_x(graphic_page),gy=scroll_y(graphic_page);
  const uint32_t tx=(uint32_t)reg16(0x14u)&1023u;
  const uint32_t ty=(uint32_t)reg16(0x16u)&1023u;
  for(uint32_t y=0;y<height;y++){
    const uint32_t sy=(y+gy)&511u;
    const uint32_t yt=(y+ty)&1023u;
    for(uint32_t x=0;x<width;x++){
      const uint32_t sx=(x+gx)&511u;
      const uint32_t word=pwp_bus_graphic_word(sx,sy);
      uint16_t color;
      if(mode==1u){
        const uint32_t idx=(word>>(graphic_page*4u))&15u;
        color=pwp_bus_palette_word(idx,0);
      } else if(mode==2u){
        const uint32_t idx=(word>>(graphic_page*8u))&255u;
        color=pwp_bus_palette_word(idx,0);
      } else color=(uint16_t)word;
      if(overlay_text){
        const uint32_t ti=pwp_bus_text_index((x+tx)&1023u,yt);
        if(ti)color=pwp_bus_palette_word(ti,1);
      }
      const uint32_t rgba=pwp_frame_grb8888(color);
      const uint32_t dst=(y*width+x)*4u;
      frame_rgba[dst]=(uint8_t)(rgba>>24);
      frame_rgba[dst+1u]=(uint8_t)(rgba>>16);
      frame_rgba[dst+2u]=(uint8_t)(rgba>>8);
      frame_rgba[dst+3u]=255u;
    }
  }
  frame_bytes=width*height*4u;
  return 1;
}


/* R16 FIX17R2 256-color graphics scanout; independent implementation.
 * VC R1 selects four 4-bit physical graphics pages in priority order.
 * In 512-dot 256-color mode, paired slots form 8-bit logical graphics:
 *   screen front = low nibble(slot 0) | high nibble(slot 1)<<4
 *   screen back  = low nibble(slot 2) | high nibble(slot 3)<<4
 * VC R2 enables either nibble of a PAIR as a complete logical graphics layer.
 * Slots are NOT individual independent 256-color pages! The previous FIX17
 * ignored physical pages 2/3 and consequently could not show the back screen.
 * Each selected physical nibble has its own CRTC page scroll R12..R19.
 * Transparency is determined by 8-bit PALETTE INDEX zero, not palette RGB;
 * foreground index != 0 prevents background exposure even when RGB is zero.
 * Text is only an optional simple non-zero overlay (NOT full priority).
 * BG/sprites, raster IRQ timing and extended blending remain out of scope.
 * All bytes originate in the guest bus, never host-supplied fabricated PAN art.
 */
static uint32_t nibble_at(uint32_t physical_page,uint32_t x,uint32_t y){
  const uint32_t sx=(x+scroll_x(physical_page))&511u;
  const uint32_t sy=(y+scroll_y(physical_page))&511u;
  return ((uint32_t)pwp_bus_graphic_word(sx,sy)>>(4u*physical_page))&15u;
}
int pwp_frame_render_mode10(uint32_t width,uint32_t height,uint32_t overlay_text){
  frame_bytes=0;
  if(!width||!height||width>512u||height>512u||overlay_text>1u)return 0;
  if((pwp_bus_crtc_register(0x28u)&0x0fu)!=1u)return 0;
  const uint32_t r1=pwp_bus_vctrl_r1();
  const uint32_t r2=pwp_bus_vctrl_r2();
  /* FIX36: R1 high byte encodes graphics, TEXT and BG layer priorities.
   * A smaller priority value is closer to the viewer; see PX68K
   * windraw.c VCReg1[0] grp_pri/text_pri/bg_pri and final compositor.
   * FIX35 incorrectly painted TEXT after GRAPHICS unconditionally. */
  const uint32_t gfx_priority=(r1>>8)&3u;
  const uint32_t text_priority=(r1>>10)&3u;
  const uint32_t bg_priority=(r1>>12)&3u;
  gfx_nonzero=text_nonzero=gfx_text_overlap=0u;
  gfx_palette_zero=gfx_visible_pixels=text_visible_pixels=0u;
  /* Reject unimplemented half-transparency / extended priority modes. */
  if((r2&0x1c00u)!=0u)return 0;
  const uint32_t pages[4]={r1&3u,(r1>>2)&3u,(r1>>4)&3u,(r1>>6)&3u};
  const int front_on=(r2&3u)!=0u;
  const int back_on=(r2&12u)!=0u;
  const uint32_t tx=(uint32_t)reg16(0x14u)&1023u;
  const uint32_t ty=(uint32_t)reg16(0x16u)&1023u;
  for(uint32_t y=0;y<height;y++){
    /* FIX34: real guest-driven CYNTHIA sprite/BG indices. When SON is off
     * the buffer is all zero and D17SLOW graphic output is unchanged. */
    uint8_t cy_line[512];
    pwp_bus_cynthia_line(y,width,cy_line);
    for(uint32_t x=0;x<width;x++){
      uint32_t front=0,back=0;
      if(front_on)front=nibble_at(pages[0],x,y)|(nibble_at(pages[1],x,y)<<4);
      if(back_on && (!front_on || front==0))
        back=nibble_at(pages[2],x,y)|(nibble_at(pages[3],x,y)<<4);
      /* FIX26: A zero graphics pixel is not an instruction to substitute
       * TEXT palette entry 0.  Graphic palette entry 0 is writable and may
       * be visibly non-black (e.g. palette-0 gradient/background effects).
       * Preserve front/back zero-index priority selection, but resolve the
       * final color from GRAPHIC palette #0 whenever graphics is enabled.
       * Only the graphics-off case falls back to TEXT palette #0.
       * This does not implement full sprite/BG/translucency priority.
       */
      const uint32_t index=front?front:back;
      const int graphics_on=front_on||back_on;
      const int graphic_pixel=graphics_on && index!=0u;
      const int bg_pixel=((r2&0x40u)!=0u)&&cy_line[x]!=0u;
      const uint32_t ti=(overlay_text && (r2&0x20u))
          ?pwp_bus_text_index((x+tx)&1023u,(y+ty)&1023u):0u;
      const int text_pixel=ti!=0u;
      if(graphic_pixel){
        gfx_nonzero++;
        if(pwp_bus_palette_word(index,0)==0u)gfx_palette_zero++;
      }
      if(text_pixel)text_nonzero++;
      if(graphic_pixel && text_pixel)gfx_text_overlap++;
      /* Transparent index 0 allows lower layers through. If nothing is
       * opaque, retain the prior genuine graphics palette-0 semantics. */
      uint16_t color=graphics_on?pwp_bus_palette_word(index,0)
                                :pwp_bus_palette_word(0,1);
      if(graphics_on && index==0u && color==0u &&
         palette0_evidence_enabled) color=palette0_evidence_color;
      /* Resolve each opaque layer by the VC R1 priority rather than
       * assuming TEXT always wins. On equal priority PX68K draws TEXT
       * above BG, and BG above GRAPHICS. A black palette entry is still
       * an opaque nonzero graphics index: never invent a color. */
      int winning=graphic_pixel?1:0;
      uint32_t winning_priority=graphic_pixel?gfx_priority:4u;
      if(bg_pixel && bg_priority<=winning_priority){
        color=pwp_bus_palette_word(cy_line[x],1);
        winning=2;winning_priority=bg_priority;
      }
      if(text_pixel && text_priority<=winning_priority){
        color=pwp_bus_palette_word(ti,1);
        winning=3;winning_priority=text_priority;
      }
      if(winning==1)gfx_visible_pixels++;
      if(winning==3)text_visible_pixels++;
      const uint32_t rgba=pwp_frame_grb8888(color);
      const uint32_t dst=(y*width+x)*4u;
      frame_rgba[dst]=(uint8_t)(rgba>>24);
      frame_rgba[dst+1u]=(uint8_t)(rgba>>16);
      frame_rgba[dst+2u]=(uint8_t)(rgba>>8);
      frame_rgba[dst+3u]=255u;
    }
  }
  frame_bytes=width*height*4u;
  return 1;
}
