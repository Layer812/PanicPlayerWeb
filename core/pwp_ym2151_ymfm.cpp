/* Real YM2151 waveforms from external, commit-pinned BSD-3-Clause ymfm.
 * This file only implements Layer812's independent X68000 clock/queue bridge.
 * It contains no derived tables or copied ymfm implementation.
 * SPDX-License-Identifier: MIT (this bridge only).
 */
#include "pwp_ym2151_bridge.h"
#include "ymfm_opm.h"
#include <cstdint>
#include <algorithm>

namespace {
struct OpmInterface final : ymfm::ymfm_interface {
    // The existing genuine-guest-clocked YM2151 Timer A/B adapter owns
    // status bits and MFP GPIP3. ymfm here supplies waveform generation only.
    // Never synthesize timers from host wall-clock time.
};
OpmInterface intf;
ymfm::ym2151 chip(intf);
uint32_t cycle_phase=0u;
constexpr uint32_t CPU_CYCLES_PER_SAMPLE=256u; // 16MHz / (4MHz/64)
constexpr uint32_t FIFO_SIZE=32768u; // ~524ms at 62500Hz, power of two
uint32_t fifo[FIFO_SIZE];
uint32_t read_index=0,write_index=0,lost_samples=0;
uint32_t pack_sample(int32_t left,int32_t right){
    left=std::max(-32768,std::min(32767,left));
    right=std::max(-32768,std::min(32767,right));
    return uint32_t(uint16_t(left)) | (uint32_t(uint16_t(right))<<16);
}
}
extern "C" {
void pwp_ym2151_reset(void){
    chip.reset(); cycle_phase=0;
    read_index=write_index=lost_samples=0;
}
void pwp_ym2151_write(uint8_t reg,uint8_t value){
    chip.write_address(reg); chip.write_data(value);
}
void pwp_ym2151_advance(uint32_t cycles){
    uint32_t frames=(cycle_phase+cycles)/CPU_CYCLES_PER_SAMPLE;
    cycle_phase=(cycle_phase+cycles)%CPU_CYCLES_PER_SAMPLE;
    for(uint32_t i=0;i<frames;i++){
        ymfm::ym2151::output_data output;
        chip.generate(&output);
        if(write_index-read_index<FIFO_SIZE){
            fifo[write_index&(FIFO_SIZE-1u)]=pack_sample(output.data[0],output.data[1]);
            ++write_index;
        }else ++lost_samples;
    }
}
uint32_t pwp_ym2151_pending(void){return write_index-read_index;}
uint32_t pwp_ym2151_pop(void){
    if(read_index==write_index)return 0u; // Caller must check pending().
    return fifo[(read_index++)&(FIFO_SIZE-1u)];
}
uint32_t pwp_ym2151_sample_rate(void){return chip.sample_rate(4000000u);}
uint32_t pwp_ym2151_overflows(void){return lost_samples;}
void pwp_ym2151_discard(void){read_index=write_index;}
}
