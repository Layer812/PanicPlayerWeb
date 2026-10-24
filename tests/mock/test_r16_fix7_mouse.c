#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_pc(void),pwp_mu_iocs_tgusemd_calls(void);
extern uint32_t pwp_mu_iocs_graphics_use(void),pwp_mu_iocs_text_use(void);
extern uint32_t pwp_mu_iocs_ms_init_calls(void),pwp_mu_mouse_initialized(void),pwp_mu_mouse_cursor_visible(void);
extern void m68k_write_memory_16(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"FAIL line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define CODE 0x10000u
static int32_t trap(unsigned fn,unsigned d1,unsigned d2){
  m68k_write_memory_16(CODE,0x4e4fu);
  m68k_set_reg(M68K_REG_PC,CODE);
  m68k_set_reg(M68K_REG_D0,fn);
  m68k_set_reg(M68K_REG_D1,d1);
  m68k_set_reg(M68K_REG_D2,d2);
  CHECK(pwp_mu_run(1)==2);
  return pwp_mu_dispatch();
}
int main(void){
  CHECK(pwp_mu_test_stage_byte(0,'H'));
  CHECK(pwp_mu_test_stage_byte(1,'U'));
  CHECK(pwp_mu_test_stage_byte(15,16));
  CHECK(pwp_mu_load(80)==1);
  CHECK(!pwp_mu_iocs_ms_init_calls() && !pwp_mu_mouse_initialized());
  CHECK(!pwp_mu_mouse_cursor_visible());
  CHECK(trap(0x0e,0,3)==1);
  CHECK(trap(0x0e,1,2)==1);
  CHECK(pwp_mu_iocs_tgusemd_calls()==2);
  CHECK(trap(0x70,0xaabbccdd,0x11223344)==1);
  CHECK(pwp_mu_pc()==CODE+2);
  CHECK(pwp_mu_iocs_ms_init_calls()==1 && pwp_mu_mouse_initialized()==1);
  CHECK(pwp_mu_mouse_cursor_visible()==0);
  CHECK(pwp_mu_iocs_graphics_use()==3 && pwp_mu_iocs_text_use()==2);
  CHECK(pwp_mu_iocs_tgusemd_calls()==2);
  /* Mouse resets are repeatable; initialization never fabricates events. */
  CHECK(trap(0x70,0,0)==1);
  CHECK(pwp_mu_iocs_ms_init_calls()==2 && pwp_mu_mouse_initialized()==1);
  /* Unimplemented hardware cursor IOCS still blocks safely. */
  CHECK(trap(0x71,0,0)==2);
  CHECK(pwp_mu_iocs_ms_init_calls()==2 && pwp_mu_mouse_cursor_visible()==0);
  CHECK(trap(0x74,0,0)==2);
  CHECK(pwp_mu_iocs_ms_init_calls()==2);
  /* Reload resets mouse state and all prior IOCS counters. */
  CHECK(pwp_mu_load(80)==1);
  CHECK(pwp_mu_iocs_ms_init_calls()==0 && pwp_mu_mouse_initialized()==0);
  CHECK(pwp_mu_mouse_cursor_visible()==0);
  CHECK(pwp_mu_iocs_graphics_use()==0 && pwp_mu_iocs_text_use()==0);
  puts("PASS R16 FIX7 IOCS $70 _MS_INIT reset/idempotence/no-fake-cursor; MOCK CPU ONLY");
}
