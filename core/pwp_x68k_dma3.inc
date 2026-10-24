/* FIX43: HD63450 DMA3 single-block ADPCM bus-master path.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
 * PX68K x68k/dmac.c: exact tested DCR=80/OCR=32/SCR=04 RAM->E92003 path.
 * Timing: PX68K adpcm.c 4MHz-derived ADPCM_Clocks / 48 = DMA bytes/second;
 * 16MHz guest CPU, no host-wall pacing or fabricated completion.
 * An unknown mode/address/IRQ is rejected, not treated as a successful DMA.
 * Included inside pwp_x68k_video_bus.c, after pwp_x68k_audio_hw.inc.
 */
#define PWP_DMA3_TICKS_PER_BYTE 768000000ull /* 16,000,000 * 48 */
static const uint32_t pwp_dma3_clocks[8] = {
  93750u,125000u,187500u,125000u,46875u,62500u,93750u,62500u
};
static uint64_t pwp_dma3_clock_phase;
static uint32_t pwp_dma3_last_fault,pwp_dma3_bytes_sent,pwp_dma3_completions;
static uint8_t pwp_dma3_first_pending;
static uint32_t pwp_dma3_read16(unsigned offset){
    return ((uint32_t)dmac3_regs[offset]<<8)|dmac3_regs[offset+1u];
}
static uint32_t pwp_dma3_read24(unsigned offset){
    return ((uint32_t)dmac3_regs[offset+1u]<<16) |
           ((uint32_t)dmac3_regs[offset+2u]<<8) | dmac3_regs[offset+3u];
}
static void pwp_dma3_write16(unsigned offset,uint32_t value){
    dmac3_regs[offset]=(uint8_t)(value>>8u);
    dmac3_regs[offset+1u]=(uint8_t)value;
}
static void pwp_dma3_write24(unsigned offset,uint32_t value){
    dmac3_regs[offset]=0;
    dmac3_regs[offset+1u]=(uint8_t)(value>>16u);
    dmac3_regs[offset+2u]=(uint8_t)(value>>8u);
    dmac3_regs[offset+3u]=(uint8_t)value;
}
static void pwp_dma3_reset(void){
    pwp_dma3_clock_phase=0;pwp_dma3_last_fault=0;
    pwp_dma3_bytes_sent=pwp_dma3_completions=0;pwp_dma3_first_pending=0;
}
static int pwp_dma3_begin(uint8_t ccr){
    /* No interrupt/chain IRQ simulation: unsupported requests fail closed. */
    if((ccr&0x48u) || dmac3_regs[0x00u]&0xf8u ||
       dmac3_regs[0x04u]!=0x80u ||
       dmac3_regs[0x05u]!=0x32u ||
       dmac3_regs[0x06u]!=0x04u ||
       pwp_dma3_read24(0x14u)!=PWP_ADPCM_DATA ||
       pwp_dma3_read16(0x0au)==0u) return 0;
    dmac3_regs[0x07u]=(uint8_t)((ccr&0x2fu)|0x80u);
    dmac3_regs[0x00u]|=0x08u; /* CSR ACT */
    dmac3_regs[0x01u]=0;       /* CER cleared on valid start */
    pwp_dma3_clock_phase=0;
    pwp_dma3_first_pending=1u;
    return 1;
}
static int pwp_dma3_send_byte(const uint8_t *ram,uint32_t size){
    uint32_t mar=pwp_dma3_read24(0x0cu);
    const uint32_t mtc=pwp_dma3_read16(0x0au);
    if(!mtc || mar>=size){
        pwp_dma3_last_fault=mar;
        return 0; /* unsupported guest memory is not aliased/made up */
    }
    if(!pwp_sound_emit(ram[mar])){
        pwp_dma3_last_fault=PWP_ADPCM_DATA;
        return 0;
    }
    pwp_dma3_write24(0x0cu,mar+1u); /* SCR=04: source increment one */
    pwp_dma3_write16(0x0au,mtc-1u);
    ++pwp_dma3_bytes_sent;
    if(mtc==1u){
        dmac3_regs[0x00u]=(uint8_t)((dmac3_regs[0x00u]&0xf7u)|0x80u);
        /* The HD63450 CCR STR bit remains set until guest reset/abort. */
        ++pwp_dma3_completions;
    }
    return 1;
}
int pwp_bus_dma3_step(uint32_t cycles,const uint8_t *ram,uint32_t ram_size){
    if(!(dmac3_regs[0x00u]&0x08u))return 1; /* no active DMA */
    if(!ram || !ram_size)return 0;
    if(pwp_dma3_first_pending){
        pwp_dma3_first_pending=0;
        if(!pwp_dma3_send_byte(ram,ram_size))return 0;
    }
    if(!(dmac3_regs[0x00u]&0x08u))return 1;
    if(dmac3_regs[0x07u]&0x20u)return 1; /* CCR HALT */
    /* Fixed-point byte clock; preserve remainder even during CPU bursts. */
    pwp_dma3_clock_phase+=(uint64_t)cycles*pwp_dma3_clocks[pwp_adpcm_sample_rate_index()];
    while(pwp_dma3_clock_phase>=PWP_DMA3_TICKS_PER_BYTE &&
          (dmac3_regs[0x00u]&0x08u)){
        pwp_dma3_clock_phase-=PWP_DMA3_TICKS_PER_BYTE;
        if(!pwp_dma3_send_byte(ram,ram_size))return 0;
    }
    return 1;
}
uint32_t pwp_bus_dma3_fault_address(void){return pwp_dma3_last_fault;}
uint32_t pwp_bus_dma3_bytes_sent(void){return pwp_dma3_bytes_sent;}
uint32_t pwp_bus_dma3_completions(void){return pwp_dma3_completions;}
uint32_t pwp_bus_dma3_register(uint32_t off){
    return (off<0x40u && dmac3_valid((unsigned)off))?dmac3_regs[off]:256u;
}
