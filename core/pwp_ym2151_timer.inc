/* Z-MUSIC v2 experimental YM2151 timer-only peripheral.
 * Original Layer812 integration code. SPDX-License-Identifier: MIT.
 * Not a synthesizer: only the actual 4 MHz YM2151 timers, status bits
 * and the electrical IRQ edge into the minimal MC68901 GPIP3 model.
 * 16 MHz guest 68000 cycles / 4 MHz OPM clock = 4 CPU cycles / clock.
 */
#ifndef PWP_EXPERIMENTAL_ZM2
#error "OPM timers must remain isolated from the production Pages build"
#endif
static uint32_t pwp_zm2_timer_left[2],pwp_zm2_timer_overflows[2];
static uint8_t pwp_zm2_timer_flags,pwp_zm2_timer_ctl;
static uint32_t pwp_zm2_timer_period(unsigned id) {
    if(id==0u){
        uint32_t a=((uint32_t)pwp_zm2_opm_registers[0x10u]<<2u)
                    |(pwp_zm2_opm_registers[0x11u]&3u);
        return (1024u-a)*256u; /* YM A: 64 clocks / count */
    }
    return (256u-pwp_zm2_opm_registers[0x12u])*4096u; /* B: 1024 clocks */
}
static void pwp_zm2_timer_update_line(void) {
    const uint8_t irq_enable=(uint8_t)((pwp_zm2_timer_ctl>>2u)&3u);
    pwp_mfp_opm_line((pwp_zm2_timer_flags&irq_enable)!=0u);
}
static void pwp_zm2_timer_reset(void) {
    pwp_zm2_timer_left[0]=pwp_zm2_timer_left[1]=0u;
    pwp_zm2_timer_overflows[0]=pwp_zm2_timer_overflows[1]=0u;
    pwp_zm2_timer_flags=pwp_zm2_timer_ctl=0u;
    pwp_mfp_opm_line(0);
}
static void pwp_zm2_timer_write(uint8_t reg,uint8_t value) {
    if(reg!=0x14u)return; /* $10/$11/$12 update the next timer reload. */
    const uint8_t old=pwp_zm2_timer_ctl;
    if(value&0x10u)pwp_zm2_timer_flags&=(uint8_t)~1u;
    if(value&0x20u)pwp_zm2_timer_flags&=(uint8_t)~2u;
    pwp_zm2_timer_ctl=value&0x0fu;
    for(unsigned id=0;id<2u;id++){
        const uint8_t mask=(uint8_t)(1u<<id);
        if(!(pwp_zm2_timer_ctl&mask))pwp_zm2_timer_left[id]=0u;
        else if(!(old&mask))pwp_zm2_timer_left[id]=pwp_zm2_timer_period(id);
    }
    pwp_zm2_timer_update_line();
}
static void pwp_zm2_timer_advance(uint32_t elapsed) {
    uint8_t overflowed=0u;
    for(unsigned id=0;id<2u;id++) {
        if(!(pwp_zm2_timer_ctl&(1u<<id)))continue;
        uint32_t left=pwp_zm2_timer_left[id];
        if(!left)left=pwp_zm2_timer_period(id);
        if(elapsed<left){pwp_zm2_timer_left[id]=left-elapsed;continue;}
        const uint32_t period=pwp_zm2_timer_period(id);
        const uint32_t after=elapsed-left;
        const uint32_t count=1u+after/period;
        pwp_zm2_timer_left[id]=period-(after%period);
        pwp_zm2_timer_overflows[id]+=count;
        overflowed|=(uint8_t)(1u<<id);
    }
    if(overflowed) {
        pwp_zm2_timer_flags|=overflowed;
        pwp_zm2_timer_update_line();
    }
}
