#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_pc(void),pwp_mu_iocs_tgusemd_calls(void);
extern uint32_t pwp_mu_iocs_graphics_use(void),pwp_mu_iocs_text_use(void);
extern void m68k_write_memory_16(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"FAIL line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define CODE 0x10000u
static int32_t trap(unsigned fn,unsigned screen,unsigned status){
  m68k_write_memory_16(CODE,0x4e4fu);
  m68k_set_reg(M68K_REG_PC,CODE);
  m68k_set_reg(M68K_REG_D0,fn);
  m68k_set_reg(M68K_REG_D1,screen);
  m68k_set_reg(M68K_REG_D2,status);
  CHECK(pwp_mu_run(1)==2);
  return pwp_mu_dispatch();
}
int main(void){
  CHECK(pwp_mu_test_stage_byte(0,'H'));
  CHECK(pwp_mu_test_stage_byte(1,'U'));
  CHECK(pwp_mu_test_stage_byte(15,16)); /* text segment=16 */
  CHECK(pwp_mu_load(80)==1);
  CHECK(pwp_mu_iocs_tgusemd_calls()==0);
  CHECK(pwp_mu_iocs_graphics_use()==0 && pwp_mu_iocs_text_use()==0);
  CHECK(trap(0x0e,0,0xffffffffu)==1);
  CHECK(pwp_mu_register(0)==0 && pwp_mu_pc()==CODE+2);
  CHECK(pwp_mu_iocs_graphics_use()==0);
  CHECK(trap(0x0e,0,3)==1); /* unused -> contents destroyed */
  CHECK(pwp_mu_register(0)==0 && pwp_mu_iocs_graphics_use()==3);
  CHECK(trap(0x0e,0,0xffu)==1);
  CHECK(pwp_mu_register(0)==3 && pwp_mu_iocs_graphics_use()==3);
  CHECK(trap(0x0e,1,2)==1);
  CHECK(pwp_mu_register(0)==0 && pwp_mu_iocs_text_use()==2);
  CHECK(pwp_mu_iocs_graphics_use()==3);
  CHECK(trap(0x0e,1,0xffu)==1);
  CHECK(pwp_mu_register(0)==2 && pwp_mu_iocs_text_use()==2);
  CHECK(trap(0x0e,2,0xffu)==1);
  CHECK((int32_t)pwp_mu_register(0)==-1);
  CHECK(pwp_mu_iocs_text_use()==2);
  CHECK(pwp_mu_iocs_tgusemd_calls()==6);
  /* Unrecognized status and unrelated IOCS are NOT silently accepted. */
  CHECK(trap(0x0e,0,0x7fu)==2);
  CHECK(pwp_mu_iocs_graphics_use()==3);
  CHECK(pwp_mu_iocs_tgusemd_calls()==6);
  CHECK(trap(0x10,0,0xffu)==2);
  CHECK(pwp_mu_iocs_graphics_use()==3);
  CHECK(pwp_mu_iocs_tgusemd_calls()==6);
  CHECK(pwp_mu_load(80)==1); /* reload resets graphics/text use */
  CHECK(pwp_mu_iocs_tgusemd_calls()==0);
  CHECK(pwp_mu_iocs_graphics_use()==0 && pwp_mu_iocs_text_use()==0);
  puts("PASS R16 FIX6 IOCS _TGUSEMD query/set/old-state/reject/reset; MOCK CPU ONLY");
}
