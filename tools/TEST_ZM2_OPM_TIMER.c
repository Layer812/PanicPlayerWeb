/* Standalone bus-level YM2151 timer -> MFP3 acceptance.
 * No fake guest service, no audio-output claim. SPDX-License-Identifier: MIT.
 */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "../core/pwp_x68k_video_bus.h"
#define OPM_ADDR 0xe90001u
#define OPM_DATA 0xe90003u
static void opm(uint8_t reg,uint8_t value){
    /* Respect actual YM2151 busy time BEFORE the next data write. */
    pwp_bus_audio_advance_cycles(272u);
    assert(pwp_bus_write8(OPM_ADDR,reg));
    assert(pwp_bus_write8(OPM_DATA,value));
}
static uint8_t status(void){
    uint8_t v=0;
    assert(pwp_bus_read8(OPM_DATA,&v));
    return v;
}
int main(void){
    pwp_bus_reset();
    assert((status()&3u)==0u);
    /* Timer A = 1023 => 64 / 4 MHz = 256 guest 68000 cycles. */
    opm(0x10u,0xffu);opm(0x11u,3u);
    opm(0x14u,0x05u); /* start A; enable IRQ A */
    assert((status()&3u)==0u);
    pwp_bus_audio_advance_cycles(255u);
    assert((status()&3u)==0u);
    pwp_bus_audio_advance_cycles(1u);
    assert((status()&1u)!=0u);
    assert(pwp_bus_mfp_opm_irq_ready());
    pwp_bus_mfp_opm_ack();
    assert(!pwp_bus_mfp_opm_irq_ready());
    /* Clearing the YM status restores its IRQ line high; next overflow
       produces a new falling GPIP3 edge and a new pending MFP IRQ. */
    opm(0x14u,0x15u);
    assert((status()&1u)==0u);
    assert(!pwp_bus_mfp_opm_irq_ready());
    pwp_bus_audio_advance_cycles(256u);
    assert((status()&1u)!=0u && pwp_bus_mfp_opm_irq_ready());
    opm(0x14u,0x30u); /* clear both flags and stop timers */
    assert((status()&3u)==0u);
    assert(!pwp_bus_mfp_opm_irq_ready());
    /* Timer B = 255 => 1024 / 4 MHz = 4096 CPU cycles. */
    opm(0x12u,0xffu);
    opm(0x14u,0x0au); /* start B; IRQ B enable */
    pwp_bus_audio_advance_cycles(4095u);
    assert((status()&3u)==0u);
    pwp_bus_audio_advance_cycles(1u);
    assert((status()&2u)!=0u);
    assert(pwp_bus_mfp_opm_irq_ready());
    pwp_bus_mfp_opm_ack();
    opm(0x14u,0x2au); /* clear B flag but keep B running */
    assert((status()&3u)==0u);
    assert(!pwp_bus_mfp_opm_irq_ready());
    puts("PASS experimental YM2151 Timer A/B 16MHz-clocked overflow, flags, MFP GPIP3");
    return 0;
}
