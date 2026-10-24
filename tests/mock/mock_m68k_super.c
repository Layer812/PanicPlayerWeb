/* R16 FIX4: CPU register-bank mock for DOS bridge tests only.
 * Does NOT emulate any actual 68000 instruction. The genuine CPU path has
 * a separate mandatory REAL Musashi WASM acceptance gate. */
#include "m68k.h"
#include <string.h>
static unsigned int regs[24];
static unsigned int sp, usp, isp, sr;
void m68k_init(void){memset(regs,0,sizeof regs);sp=usp=isp=sr=0;}
void m68k_set_cpu_type(unsigned int t){(void)t;}
void m68k_pulse_reset(void){sp=isp=0x3f0000u;sr=0x2000u;}
void m68k_set_reg(m68k_register_t reg,unsigned int v){
  switch(reg){
    case M68K_REG_SR:sr=v;break; /* public setter uses nosp */
    case M68K_REG_A7:sp=v;break;
    case M68K_REG_USP:if(sr&0x2000)usp=v;else sp=v;break;
    case M68K_REG_ISP:if(sr&0x2000)sp=v;else isp=v;break;
    default:regs[reg]=v;break;
  }
}
unsigned int m68k_get_reg(void *ctx,m68k_register_t reg){
  (void)ctx;
  switch(reg){
    case M68K_REG_SR:return sr;
    case M68K_REG_A7:return sp;
    case M68K_REG_USP:return sr&0x2000?usp:sp;
    case M68K_REG_ISP:return sr&0x2000?sp:isp;
    default:return regs[reg];
  }
}
int m68k_execute(int n){return n;}
void m68k_end_timeslice(void){}
