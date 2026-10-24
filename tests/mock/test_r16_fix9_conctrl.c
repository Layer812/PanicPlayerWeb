/* R16 FIX9: bounded Human68k _CONCTRL bridge and reset-state proof.
 * Mock CPU verifies C semantics only. True Musashi is separately gated in WASM. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_pc(void);
extern uint32_t pwp_mu_conctrl_calls(void),pwp_mu_conctrl_screen_mode(void),pwp_mu_conctrl_fnkeys_mode(void),pwp_mu_conctrl_cursor_visible(void);
extern void m68k_write_memory_16(unsigned,unsigned),m68k_write_memory_32(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define PC 0x10000u
#define SP 0x48000u
static int32_t call(uint16_t md,uint16_t arg,int hasarg){
  m68k_write_memory_16(PC,0xff23u);
  m68k_write_memory_16(SP,md);
  if(hasarg)m68k_write_memory_16(SP+2,arg);
  m68k_set_reg(M68K_REG_A7,SP);m68k_set_reg(M68K_REG_PC,PC);
  CHECK(pwp_mu_run(1)==2);
  int32_t v=pwp_mu_dispatch();
  if(v==1)CHECK(pwp_mu_pc()==PC+2);
  if(v==2)CHECK(pwp_mu_pc()==PC);
  return v;
}
int main(void){
 CHECK(pwp_mu_test_stage_byte(0,'H'));
 CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));
 CHECK(pwp_mu_load(80)==1);
 CHECK(pwp_mu_conctrl_calls()==0);
 CHECK(pwp_mu_conctrl_cursor_visible()==1);
 CHECK(pwp_mu_conctrl_screen_mode()==0);
 CHECK(call(16,0xffff,1)==1);CHECK(pwp_mu_register(0)==0);
 CHECK(pwp_mu_conctrl_calls()==1);
 /* Screen-mode writes cannot pretend unsupported CRT/VRAM initialization. */
 CHECK(call(16,5,1)==2);CHECK(pwp_mu_conctrl_screen_mode()==0);
 CHECK(pwp_mu_conctrl_calls()==1);
 CHECK(call(14,0xffff,1)==1);CHECK(pwp_mu_register(0)==0);
 CHECK(call(14,2,1)==1);CHECK(pwp_mu_register(0)==0);
 CHECK(pwp_mu_conctrl_fnkeys_mode()==2);
 CHECK(call(14,3,1)==1);CHECK(pwp_mu_register(0)==2);
 CHECK(pwp_mu_conctrl_fnkeys_mode()==3);
 CHECK(call(14,0xffff,1)==1);CHECK(pwp_mu_register(0)==3);
 CHECK(call(14,4,1)==2);CHECK(pwp_mu_conctrl_fnkeys_mode()==3);
 CHECK(call(18,0,0)==1);CHECK(pwp_mu_register(0)==0);
 CHECK(pwp_mu_conctrl_cursor_visible()==0);
 CHECK(call(17,0,0)==1);CHECK(pwp_mu_conctrl_cursor_visible()==1);
 CHECK(call(15,0,0)==2);CHECK(pwp_mu_conctrl_calls()==7);
 /* FIX30: original PANIC.X stores mode 0 and restores it on exit.
  * Only mode 0 is supported; other modes remain fail-closed. */
 CHECK(call(16,0,1)==1);CHECK(pwp_mu_register(0)==0);
 CHECK(pwp_mu_conctrl_screen_mode()==0);
 CHECK(call(16,2,1)==2);CHECK(pwp_mu_conctrl_screen_mode()==0);
 CHECK(call(16,5,1)==2);CHECK(pwp_mu_conctrl_screen_mode()==0);
 CHECK(pwp_mu_conctrl_calls()==8);
 /* Invalid source-args addresses must not read across the last RAM byte. */
 m68k_write_memory_16(PC,0xff23);m68k_set_reg(M68K_REG_PC,PC);
 m68k_set_reg(M68K_REG_A7,0x3ffffe);
 m68k_write_memory_16(0x3ffffe,16);
 CHECK(pwp_mu_run(1)==2);CHECK(pwp_mu_dispatch()==-8);
 /* Reload a fresh HU and verify all bookkept state resets. */
 CHECK(pwp_mu_test_stage_byte(0,'H'));
 CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));
 CHECK(pwp_mu_load(80)==1);
 CHECK(pwp_mu_conctrl_calls()==0);
 CHECK(pwp_mu_conctrl_screen_mode()==0);
 CHECK(pwp_mu_conctrl_fnkeys_mode()==0);
 CHECK(pwp_mu_conctrl_cursor_visible()==1);
 puts("PASS R16 FIX9 Human68k _CONCTRL subset and fail-closed screen mode; MOCK CPU ONLY");
 return 0;
}
