/* Genuine C HU loader and guest RAM ABI; CPU registers supplied by mock.
 * This does NOT execute 68000 instructions or qualify a Musashi build. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "m68k.h"
extern void pwp_mu_reset(void);
extern int32_t pwp_mu_load(uint32_t);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_guest_peek8(uint32_t);
extern uint32_t pwp_mu_guest_peek32(uint32_t);
#define CHECK(x) do{ if(!(x)){fprintf(stderr,"R11 CLI FAIL line %d: %s\n",__LINE__,#x);exit(1);} }while(0)
static void stage32(uint32_t at,uint32_t val){
  for(unsigned j=0;j<4;j++)CHECK(pwp_mu_test_stage_byte(at+j,(val>>(24-8*j))&255u));
}
static void make_hu(void){
  pwp_mu_reset();
  CHECK(pwp_mu_test_stage_byte(0,'H'));
  CHECK(pwp_mu_test_stage_byte(1,'U'));
  stage32(12,4); /* Synthetic 2 x NOP, never executed here. */
  CHECK(pwp_mu_test_stage_byte(64,0x4e));
  CHECK(pwp_mu_test_stage_byte(65,0x71));
  CHECK(pwp_mu_test_stage_byte(66,0x4e));
  CHECK(pwp_mu_test_stage_byte(67,0x71));
}
int main(void){
  static const char expected[]="C:\\P68K.PAN";
  make_hu();
  CHECK(pwp_mu_load(68)==1);
  uint32_t a2=m68k_get_reg(NULL,M68K_REG_A2);
  CHECK(a2==0x8000);
  CHECK(pwp_mu_guest_peek8(a2)==sizeof(expected)-1u);
  for(uint32_t i=0;i<sizeof(expected)-1u;i++)CHECK(pwp_mu_guest_peek8(a2+i+1u)==(uint8_t)expected[i]);
  CHECK(pwp_mu_guest_peek8(a2+sizeof(expected))==0);
  CHECK(pwp_mu_guest_peek8(a2-1u)==0);
  CHECK(pwp_mu_guest_peek8(a2+sizeof(expected)+1u)==0);
  CHECK(pwp_mu_guest_peek8(0x400000u)==256u);
  CHECK(m68k_get_reg(NULL,M68K_REG_A0)==0xfff0u);
  CHECK(m68k_get_reg(NULL,M68K_REG_A1)==0x10004u);
  CHECK(m68k_get_reg(NULL,M68K_REG_A3)==0xffffffffu);
  CHECK(m68k_get_reg(NULL,M68K_REG_A4)==0x10000u);
  CHECK(pwp_mu_guest_peek32(0xfff8u)==0x3f0000u);
  CHECK(pwp_mu_guest_peek8(0x10000)==0x4e);
  CHECK(pwp_mu_guest_peek8(0x10001)==0x71);
  /* New loads must restore the fixed guest command tail. */
  make_hu();
  CHECK(pwp_mu_load(68)==1);
  CHECK(pwp_mu_guest_peek8(0x8000)==sizeof(expected)-1u);
  puts("PASS R11 native HU command-line layout (mock CPU registers; NOT Musashi execution)");
  return 0;
}
