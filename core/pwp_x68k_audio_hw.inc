/* FIX42: accurately bounded direct sound-control MMIO for PANIC.X.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
 * This is NOT a YM2151 waveform core or a DMA/ADPCM renderer.
 * Unsupported audible writes and DMA starts still fail closed.
 * Included only from pwp_x68k_video_bus.c; latch/counters are defined there.
 */
#define PWP_OPM_BUSY_CYCLES 272u /* 68 YM clocks at 4MHz, guest CPU 16MHz */
#define PWP_ADPCM_CTRL 0x00e92001u
#define PWP_ADPCM_DATA 0x00e92003u
#define PWP_PIA_C 0x00e9a005u
#define PWP_PIA_CONTROL 0x00e9a007u
static uint32_t pwp_opm_busy_remaining;
static uint32_t pwp_opm_status_reads,pwp_opm_ct_writes,pwp_opm_busy_rejects;
static uint32_t pwp_adpcm_control_writes,pwp_adpcm_data_rejects;
static uint8_t pwp_opm_ct, pwp_adpcm_playing, pwp_pia_port_c;
#ifdef PWP_EXPERIMENTAL_ZM2
/* Actual guest register state and cycle-based OPM timers. Waveforms are
 * synthesized through a separate, pinned BSD ymfm component. */
static uint8_t pwp_zm2_opm_registers[256];
static uint32_t pwp_zm2_opm_register_writes;
#include "pwp_ym2151_timer.inc"
#endif
/* Audible byte FIFO preserves chronological PANIC.X PCM data and channel/rate
 * for the host decoder; no synthetic ADPCM output or dropped bytes. */
#define PWP_SOUND_FIFO_SIZE 8192u
static uint16_t pwp_sound_fifo[PWP_SOUND_FIFO_SIZE];
static uint32_t pwp_sound_read_pos,pwp_sound_write_pos,pwp_sound_bytes,pwp_sound_overflows;
static uint32_t pwp_adpcm_sample_rate_index(void){
    return (((pwp_opm_ct&2u)?4u:0u)|((pwp_pia_port_c>>2u)&3u));
}
static int pwp_sound_marker(uint16_t tag){
    if(pwp_sound_write_pos-pwp_sound_read_pos >= PWP_SOUND_FIFO_SIZE){
        ++pwp_sound_overflows;return 0;
    }
    pwp_sound_fifo[pwp_sound_write_pos%PWP_SOUND_FIFO_SIZE]=tag;
    ++pwp_sound_write_pos;
    return 1;
}
static int pwp_sound_emit(uint8_t data){
    if(!pwp_adpcm_playing)return 1; /* Real MSM6258 discards data when stopped. */
    if(pwp_sound_write_pos-pwp_sound_read_pos >= PWP_SOUND_FIFO_SIZE){
        ++pwp_sound_overflows;return 0;
    }
    const uint32_t rate=pwp_adpcm_sample_rate_index();
    pwp_sound_fifo[pwp_sound_write_pos%PWP_SOUND_FIFO_SIZE] =
        (uint16_t)(data|((pwp_pia_port_c&3u)<<8u)|(rate<<10u));
    ++pwp_sound_write_pos;++pwp_sound_bytes;
    return 1;
}
int32_t pwp_bus_sound_pop(void){
    if(pwp_sound_read_pos==pwp_sound_write_pos)return -1;
    return (int32_t)pwp_sound_fifo[(pwp_sound_read_pos++)%PWP_SOUND_FIFO_SIZE];
}
uint32_t pwp_bus_sound_bytes(void){return pwp_sound_bytes;}
uint32_t pwp_bus_sound_overflows(void){return pwp_sound_overflows;}

void pwp_bus_audio_advance_cycles(uint32_t cycles) {
    if(cycles >= pwp_opm_busy_remaining) pwp_opm_busy_remaining=0;
    else pwp_opm_busy_remaining-=cycles;
#ifdef PWP_EXPERIMENTAL_ZM2
    pwp_zm2_timer_advance(cycles);
#ifndef PWP_ZM2_TIMER_TEST
    pwp_ym2151_advance(cycles);
#endif
#endif
}
static void pwp_audio_reset(void) {
    pwp_opm_busy_remaining=0;
    pwp_opm_status_reads=pwp_opm_ct_writes=pwp_opm_busy_rejects=0;
    pwp_adpcm_control_writes=pwp_adpcm_data_rejects=0;
    pwp_opm_ct=0;
#ifdef PWP_EXPERIMENTAL_ZM2
    for(uint32_t i=0;i<256u;i++)pwp_zm2_opm_registers[i]=0u;
    pwp_zm2_opm_register_writes=0;
    pwp_zm2_timer_reset();
#ifndef PWP_ZM2_TIMER_TEST
    pwp_ym2151_reset();
#endif
#endif
    pwp_adpcm_playing=0;
    pwp_pia_port_c=0x0bu; /* PX68K PIA_Init() */
    pwp_sound_read_pos=pwp_sound_write_pos=pwp_sound_bytes=pwp_sound_overflows=0;
}
static int pwp_audio_access8(uint32_t addr) {
    return addr==OPM_DATA_PORT || addr==PWP_ADPCM_CTRL || addr==PWP_ADPCM_DATA ||
           addr==PWP_PIA_C || addr==PWP_PIA_CONTROL;
}
static int pwp_audio_read8(uint32_t addr,uint8_t *value) {
    switch(addr) {
      case OPM_DATA_PORT:
        ++pwp_opm_status_reads;
        *value=(uint8_t)(pwp_opm_busy_remaining ? 0x80u : 0u)
#ifdef PWP_EXPERIMENTAL_ZM2
            |pwp_zm2_timer_flags
#endif
            ;
        return 1;
      case PWP_ADPCM_CTRL:
        *value=(uint8_t)(pwp_adpcm_playing ? 0xc0u : 0x40u);
        return 1;
      case PWP_ADPCM_DATA:
        *value=0; /* PX68K ADPCM_Read() */
        return 1;
      case PWP_PIA_C:
        *value=pwp_pia_port_c;
        return 1;
      case PWP_PIA_CONTROL:
        *value=0xffu; /* PX68K PIA_Read default */
        return 1;
    }
    return 0;
}
static int pwp_audio_write8(uint32_t addr,uint8_t value) {
    switch(addr) {
      case OPM_DATA_PORT:
        /* At present only YM2151 $1B CT1/CT2 outputs (clock-select)
         * are implemented. Other registers require real FM timers/sound.
         * A write during WRITE BUSY is ignored by actual OPM hardware. */
        if(pwp_opm_busy_remaining) {++pwp_opm_busy_rejects; return 1;}
#ifndef PWP_EXPERIMENTAL_ZM2
        if(opm_register_latch!=0x1bu) {++opm_data_rejections;return 0;}
#else
        /* Actual YM2151 register write drives both FM synthesis and the
         * guest-cycle-based timer/OPM IRQ model, without host-side music. */
        pwp_zm2_opm_registers[opm_register_latch]=value;
        ++pwp_zm2_opm_register_writes;
        pwp_zm2_timer_write(opm_register_latch,value);
#ifndef PWP_ZM2_TIMER_TEST
        pwp_ym2151_write(opm_register_latch,value);
#endif
#endif
        if(opm_register_latch==0x1bu){
            pwp_opm_ct=(uint8_t)((value>>6u)&3u);
            ++pwp_opm_ct_writes;
        }
        pwp_opm_busy_remaining=PWP_OPM_BUSY_CYCLES;
        return 1;
      case PWP_ADPCM_CTRL:
        /* Real MSM6258 control: RESET bit0 dominates PLAY bit1. */
        if(value&1u){
            if(pwp_adpcm_playing && !pwp_sound_marker(0x4000u))return 0;
            pwp_adpcm_playing=0;
        }else if(value&2u){
            if(!pwp_adpcm_playing && !pwp_sound_marker(0x8000u))return 0;
            pwp_adpcm_playing=1;
        }
        ++pwp_adpcm_control_writes;
        return 1;
      case PWP_ADPCM_DATA:
        if(!pwp_sound_emit(value)){++pwp_adpcm_data_rejects;return 0;}
        return 1;
      case PWP_PIA_C:
        /* PIA port C includes ADPCM pan/clock and joystick output pins.
         * Only low nibble is safe without a joystick implementation. */
        if((value^pwp_pia_port_c)&0xf0u) return 0;
        pwp_pia_port_c=value;
        return 1;
      case PWP_PIA_CONTROL:
        /* 8255 BSR can set/reset one of port C low four bits. */
        if((value&0x80u) || ((value>>1u)&7u)>3u) return 0;
        if(value&1u)pwp_pia_port_c|=(uint8_t)(1u<<((value>>1u)&7u));
        else pwp_pia_port_c&=(uint8_t)~(1u<<((value>>1u)&7u));
        return 1;
    }
    return 0;
}
uint32_t pwp_bus_opm_busy_cycles(void){return pwp_opm_busy_remaining;}
uint32_t pwp_bus_opm_status_reads(void){return pwp_opm_status_reads;}
uint32_t pwp_bus_opm_ct_writes(void){return pwp_opm_ct_writes;}
uint32_t pwp_bus_adpcm_playing(void){return pwp_adpcm_playing;}
uint32_t pwp_bus_pia_port_c(void){return pwp_pia_port_c;}
uint32_t pwp_bus_adpcm_control_writes(void){return pwp_adpcm_control_writes;}
