/* R16 FIX2: actual HU-loader/MCB/SETBLOCK/MALLOC contract with MOCK CPU.
 * This proves allocation semantics, not execution of 68000 instructions. */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "m68k.h"
extern void pwp_mu_reset(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern uint32_t pwp_mu_guest_peek32(uint32_t);
extern void m68k_write_memory_16(unsigned,unsigned),m68k_write_memory_32(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"R16 FIX2 line %d failed: %s\n",__LINE__,#x);exit(1);}} while(0)
#define PSP 0xfff0u
#define CODE 0x10000u
#define STACK 0x20000u
#define TEXT 0x39a2u
#define DATA 0x252u
#define BSS 0x1772u
#define PROGRAM_END (CODE+TEXT+DATA+BSS)
static void stage32(uint32_t at,uint32_t v) {for(unsigned i=0;i<4;i++) CHECK(pwp_mu_test_stage_byte(at+i,(v>>(24-8*i))&0xff));}
static int32_t dos_call(uint16_t op) {
  m68k_write_memory_16(CODE,op);m68k_set_reg(M68K_REG_PC,CODE);
  CHECK(pwp_mu_run(1)==2);
  CHECK(pwp_mu_dispatch()==1);
  return (int32_t)m68k_get_reg(NULL,M68K_REG_D0);
}
int main(void) {
  pwp_mu_reset();
  CHECK(pwp_mu_test_stage_byte(0,'H'));
  CHECK(pwp_mu_test_stage_byte(1,'U'));
  stage32(12,TEXT);stage32(16,DATA);stage32(20,BSS);
  CHECK(pwp_mu_load(64+TEXT+DATA)==1);
  CHECK(PROGRAM_END==0x15366u);
  /* Distinct end-of-PROGRAM vs end-of-MEMORY contracts. */
  CHECK(m68k_get_reg(NULL,M68K_REG_A0)==PSP);
  CHECK(m68k_get_reg(NULL,M68K_REG_A1)==PROGRAM_END);
  CHECK(pwp_mu_guest_peek32(PSP+8)==0x3f0000u);
  CHECK(pwp_mu_guest_peek32(PSP+12)==0);
  m68k_set_reg(M68K_REG_A7,STACK);
  m68k_write_memory_32(STACK,CODE);
  m68k_write_memory_32(STACK+4,PROGRAM_END-CODE);
  CHECK(dos_call(0xff4a)==0);
  CHECK(pwp_mu_guest_peek32(PSP+8)==PROGRAM_END);
  m68k_write_memory_32(STACK,0x40000);
  const int32_t ptr=dos_call(0xff48);
  CHECK(ptr==0x15380);
  CHECK(ptr>=0x15370 && (uint32_t)ptr+0x40000<0x3f0000u);
  CHECK(pwp_mu_guest_peek32(PSP+12)==(uint32_t)ptr-16);
  CHECK(pwp_mu_guest_peek32((uint32_t)ptr-16+4)==PSP);
  CHECK(pwp_mu_guest_peek32((uint32_t)ptr-16+8)==(uint32_t)ptr+0x40000);
  puts("PASS R16 FIX2 HU A1=PROGRAM_END, SETBLOCK SHRINK, MALLOC 256KiB (mock CPU, not actual Musashi)");
  return 0;
}
