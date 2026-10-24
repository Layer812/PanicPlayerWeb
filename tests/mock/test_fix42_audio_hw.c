/* Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#define OPM_DATA_PORT 0x00e90003u
static uint8_t opm_register_latch;
static uint32_t opm_data_rejections;
#include "pwp_x68k_audio_hw.inc"
int main(void){
 uint8_t v=0xff;
 pwp_audio_reset();assert(pwp_bus_pia_port_c()==0x0bu);
 assert(pwp_audio_access8(OPM_DATA_PORT));
 assert(!pwp_audio_access8(PWP_ADPCM_DATA));
 assert(pwp_audio_read8(OPM_DATA_PORT,&v) && v==0);
 opm_register_latch=0x1bu;
 assert(pwp_audio_write8(OPM_DATA_PORT,0x80u));
 assert(pwp_bus_opm_busy_cycles()==272u);
 assert(pwp_audio_read8(OPM_DATA_PORT,&v) && v==0x80u);
 pwp_bus_audio_advance_cycles(271);assert(pwp_bus_opm_busy_cycles()==1);
 pwp_bus_audio_advance_cycles(1);assert(pwp_bus_opm_busy_cycles()==0);
 assert(pwp_audio_write8(PWP_ADPCM_CTRL,2));
 assert(pwp_audio_read8(PWP_ADPCM_CTRL,&v) && v==0xc0);
 assert(pwp_audio_write8(PWP_PIA_C,0x08));
 assert(pwp_bus_pia_port_c()==0x08);
 assert(pwp_audio_write8(PWP_PIA_CONTROL,0x03));
 assert(pwp_bus_pia_port_c()==0x0a);
 assert(!pwp_audio_write8(PWP_PIA_C,0x88));
 assert(!pwp_audio_write8(PWP_PIA_CONTROL,0x80));
 opm_register_latch=0x20u;assert(!pwp_audio_write8(OPM_DATA_PORT,0));
 assert(opm_data_rejections==1);
 assert(pwp_audio_write8(PWP_ADPCM_CTRL,1));
 assert(pwp_audio_read8(PWP_ADPCM_CTRL,&v) && v==0x40);
 pwp_audio_reset();assert(pwp_bus_opm_busy_cycles()==0);
 assert(pwp_bus_adpcm_playing()==0);
 assert(pwp_bus_pia_port_c()==0x0b);
 puts("PASS FIX42: YM CT latch + 16MHz busy cycles, MSM6258, 8255 low-bit BSR, fail-closed");
 return 0;
}
