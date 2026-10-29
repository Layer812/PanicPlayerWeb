/* Original Layer812 integration acceptance for external, pinned BSD ymfm.
 * Tests that actual register programming generates changing, nonzero stereo
 * samples. It does NOT claim music or denkozm.pan end-to-end reproduction.
 * SPDX-License-Identifier: MIT
 */
#include "../core/pwp_ym2151_bridge.h"
#include <cassert>
#include <cstdint>
#include <cstdio>
static void opm(uint8_t reg,uint8_t value){pwp_ym2151_write(reg,value);}
int main(){
    pwp_ym2151_reset();
    assert(pwp_ym2151_sample_rate()==62500u);
    opm(0x20,0xc7); // RL + algorithm 7, ch0
    opm(0x28,0x4c); // key code, ch0
    opm(0x30,0x00); // key fraction, ch0
    // Program all four operators of channel 0 from actual OPM register values.
    for(unsigned slot=0;slot<4;slot++){
        const uint8_t off=uint8_t(slot*8);
        opm(uint8_t(0x40+off),0x01); // multiplier 1
        opm(uint8_t(0x60+off),0x00); // volume
        opm(uint8_t(0x80+off),0x1f); // fast attack
        opm(uint8_t(0xa0+off),0x00);
        opm(uint8_t(0xc0+off),0x00);
        opm(uint8_t(0xe0+off),0x0f); // fast release
    }
    opm(0x08,0x78); // real key-on all four operators on ch0
    // 4096 actual OPM output samples, at 256 guest cycles per sample.
    unsigned nonzero=0,changes=0;
    uint32_t prev=0;
    for(unsigned i=0;i<4096;i++){
        pwp_ym2151_advance(256u);
        assert(pwp_ym2151_pending()==1u);
        uint32_t sample=pwp_ym2151_pop();
        if(sample!=0u)nonzero++;
        if(i && sample!=prev)changes++;
        prev=sample;
    }
    assert(nonzero>100u);
    assert(changes>100u);
    assert(pwp_ym2151_pending()==0u);
    assert(pwp_ym2151_overflows()==0u);
    std::printf("PASS pinned ymfm YM2151 62500Hz stereo samples, nonzero=%u changes=%u\\n",nonzero,changes);
}
