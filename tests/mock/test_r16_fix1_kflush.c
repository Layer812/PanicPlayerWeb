/* R16 FIX1: verifies DOS keyboard flush ABI using mock CPU registers.
 * It is NOT a Musashi instruction execution test. */
#include "m68k.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void),pwp_mu_status(void);
extern void m68k_write_memory_16(unsigned int,unsigned int),m68k_write_memory_32(unsigned int,unsigned int);
extern uint32_t pwp_mu_exit_code(void);
#define PC 0x10000u
#define SP 0x21000u
static void stage32(uint32_t at,uint32_t v){for(unsigned j=0;j<4;j++)assert(pwp_mu_test_stage_byte(at+j,(v>>(24-8*j))&255));}
static void setup(void){
 assert(pwp_mu_test_stage_byte(0,'H'));assert(pwp_mu_test_stage_byte(1,'U'));
 stage32(12,0x400);stage32(20,0x100);
 assert(pwp_mu_load(64+0x400)==1);
 m68k_set_reg(M68K_REG_A7,SP);
}
static int32_t kflush(uint16_t mode,uint32_t extra){
 m68k_write_memory_16(SP,mode);m68k_write_memory_32(SP+2,extra);
 m68k_write_memory_16(PC,0xff0c);m68k_set_reg(M68K_REG_PC,PC);
 assert(pwp_mu_run(1)==2);
 return pwp_mu_dispatch();
}
int main(void){
 setup();
 assert(kflush(0x00ffu,0)==1); assert(m68k_get_reg(0,M68K_REG_PC)==PC+2);
 assert(kflush(0xffffu,0)==1);
 assert(kflush(6u,0x00ff0000u)==1);
 assert(kflush(0x00ffu,0x11111111u)==2); // no fake success
 assert(pwp_mu_status()==2);
 setup();
 assert(kflush(7u,0)==2); // real blocking input not implemented
 setup();
 assert(kflush(10u,0)==2);
 setup();
 assert(kflush(6u,0x00fe0000u)==2); // buffered input not implemented
 setup();
 m68k_write_memory_16(PC,0xff0c);m68k_set_reg(M68K_REG_PC,PC);
 m68k_set_reg(M68K_REG_A7,0x3fffff);
 assert(pwp_mu_run(1)==2 && pwp_mu_dispatch()==-8);
 setup();
 m68k_write_memory_16(SP,0x7531);
 m68k_write_memory_16(PC,0xff4c);m68k_set_reg(M68K_REG_PC,PC);
 assert(pwp_mu_run(1)==2 && pwp_mu_dispatch()==4 && pwp_mu_exit_code()==0x7531);
 puts("PASS R16 FIX1 KFLUSH mock DOS dispatch (no real CPU claim)");
}
