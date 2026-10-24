#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_guest_peek32(uint32_t);
extern void m68k_write_memory_16(unsigned,unsigned),m68k_write_memory_32(unsigned,unsigned);
#define CHECK(c) do{if(!(c)){fprintf(stderr,"FAIL %d: %s\n",__LINE__,#c);exit(1);}}while(0)
#define CODE 0x10000u
#define STACK 0x20000u
static void u32stage(unsigned at,unsigned value){for(unsigned i=0;i<4;i++)CHECK(pwp_mu_test_stage_byte(at+i,(value>>(24-8*i))&255));}
static int32_t trap(uint16_t op){
  m68k_write_memory_16(CODE,op);
  m68k_set_reg(M68K_REG_PC,CODE);
  CHECK(pwp_mu_run(1)==2);
  return pwp_mu_dispatch();
}
int main(void){
  CHECK(pwp_mu_test_stage_byte(0,'H'));
  CHECK(pwp_mu_test_stage_byte(1,'U'));
  u32stage(12,0x10);
  CHECK(pwp_mu_load(64+0x10)==1);
  CHECK(!(pwp_mu_register(16)&0x2000));
  CHECK(pwp_mu_register(17)==0x3f0000);
  CHECK(pwp_mu_register(18)==0x3f0000);
  m68k_set_reg(M68K_REG_A7,STACK);
  m68k_write_memory_32(STACK,0u);
  CHECK(trap(0xff20)==1);
  CHECK(pwp_mu_register(0)==0x3f0000);
  CHECK((pwp_mu_register(16)&0x2000)!=0);
  CHECK(pwp_mu_register(15)==STACK);
  CHECK(pwp_mu_register(17)==STACK);
  CHECK(pwp_mu_register(18)==STACK);
  /* Simulate ADDQ after _SUPER; the active supervisor stack advances. */
  m68k_set_reg(M68K_REG_A7,STACK+4);
  /* Double-enter must not corrupt the stack or fabricate success. */
  m68k_write_memory_32(STACK+4,0u);
  CHECK(trap(0xff20)==1);
  CHECK((int32_t)pwp_mu_register(0)==-1);
  CHECK(pwp_mu_register(15)==STACK+4);
  /* Restore saved SSP; switch back to user stack from original USP. */
  m68k_write_memory_32(STACK+4,0x3f0000u);
  CHECK(trap(0xff20)==1);
  CHECK(pwp_mu_register(0)==0);
  CHECK((pwp_mu_register(16)&0x2000)==0);
  CHECK(pwp_mu_register(15)==STACK);
  CHECK(pwp_mu_register(17)==STACK);
  CHECK(pwp_mu_register(18)==0x3f0000);
  /* Non-zero 'restore' from user mode: negative Human68k-style error,
   * must stay in user mode and preserve stack. */
  m68k_write_memory_32(STACK,0x3f0000u);
  CHECK(trap(0xff20)==1);
  CHECK((int32_t)pwp_mu_register(0)==-14);
  CHECK((pwp_mu_register(16)&0x2000)==0);
  CHECK(pwp_mu_register(15)==STACK);
  puts("PASS R16 FIX4 DOS _SUPER mode + USP/SSP round-trip; CPU MOCK ONLY");
}
