/* Mock used ONLY for adapter tests: exercises bus callbacks and dispatch.
 * DOES NOT execute any 68000 opcodes or confirm Musashi integration. */
#include "m68k.h"
#include <string.h>
static unsigned int registers[24];
void m68k_init(void){memset(registers,0,sizeof registers);}
void m68k_set_cpu_type(unsigned int type){(void)type;}
void m68k_pulse_reset(void){}
void m68k_set_reg(m68k_register_t r,unsigned int v){registers[r]=v;}
unsigned int m68k_get_reg(void *ctx,m68k_register_t r){(void)ctx;return registers[r];}
int m68k_execute(int n){return n;}
void m68k_end_timeslice(void){}

/* The unit-test double does NOT deliver an interrupt; actual acceptance
 * requires Tab5 Musashi and the authentic PANIC.X guest ISR. */
void m68k_set_irq(unsigned int level){(void)level;}
