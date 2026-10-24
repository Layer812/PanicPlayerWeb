/* FIX10 IOCS CRTMOD register semantics, mock CPU only. Real CPU gate is JS. */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include "m68k.h"
#include "pwp_x68k_video_bus.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_pc(void),pwp_mu_iocs_crtmod_calls(void),pwp_mu_iocs_crt_mode(void);
extern void m68k_write_memory_16(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"FAIL FIX10 line %d: %s\n",__LINE__,#x);exit(1);}} while(0)
#define PC 0x10000u
#define SP 0x48000u
static int32_t call(uint16_t d1,int success){
 m68k_write_memory_16(PC,0x4e4f);
 m68k_set_reg(M68K_REG_D0,16);
 m68k_set_reg(M68K_REG_D1,d1);
 m68k_set_reg(M68K_REG_A7,SP);
 m68k_set_reg(M68K_REG_PC,PC);
 CHECK(pwp_mu_run(1)==2);
 CHECK(pwp_mu_dispatch()==(success?1:2));
 CHECK(pwp_mu_pc()==PC+(success?2:0));
 return (int32_t)pwp_mu_register(0);
}
int main(void){
 CHECK(pwp_mu_test_stage_byte(0,'H'));
 CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));
 CHECK(pwp_mu_load(80)==1);
 CHECK(pwp_mu_iocs_crt_mode()==0 && pwp_mu_iocs_crtmod_calls()==0);
 CHECK(pwp_bus_crtc_register(0x28)==0);
 CHECK(call(0xffffu,1)==0); /* mode query only */
 CHECK(pwp_mu_iocs_crt_mode()==0 && pwp_mu_iocs_crtmod_calls()==1);
 CHECK(pwp_bus_crtc_register(0x28)==0);
 CHECK(call(10u,1)==0); /* 256 color / 256x256 visible */
 CHECK(pwp_mu_iocs_crt_mode()==10 && pwp_mu_iocs_crtmod_calls()==2);
 CHECK((pwp_bus_crtc_register(0x28)&0x0f)==1);
 CHECK(pwp_bus_video_writes()==0 && pwp_bus_pixel_mutations()==0);
 CHECK(call(0xffffu,1)==10);
 CHECK(pwp_mu_iocs_crtmod_calls()==3);
 CHECK(call(11u,0)==16);
 CHECK(pwp_mu_iocs_crt_mode()==10 && pwp_mu_iocs_crtmod_calls()==3);
 CHECK(call(0x010au,0)==16); /* $100 skip-clear mode not emulated */
 CHECK(pwp_mu_iocs_crt_mode()==10 && pwp_mu_iocs_crtmod_calls()==3);
 CHECK(pwp_mu_test_stage_byte(0,'H'));CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));CHECK(pwp_mu_load(80)==1);
 CHECK(pwp_mu_iocs_crt_mode()==0 && pwp_mu_iocs_crtmod_calls()==0);
 CHECK(pwp_bus_crtc_register(0x28)==0);
 puts("PASS FIX10 IOCS CRTMOD register/mode/bus semantics (mock CPU only)");
 return 0;
}
