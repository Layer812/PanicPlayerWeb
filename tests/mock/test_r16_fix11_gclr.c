/* FIX11 independent video clear/display and IOCS dispatch acceptance, mock CPU. */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include "m68k.h"
#include "pwp_x68k_video_bus.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_pc(void),pwp_mu_iocs_gclr_calls(void),pwp_mu_iocs_crt_mode(void);
extern uint32_t pwp_mu_graphics_display_enabled(void),pwp_mu_graphics_clear_count(void),pwp_mu_graphics_access_page(void);
extern void m68k_write_memory_16(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"FAIL FIX11 line %d: %s\n",__LINE__,#x);exit(1);}} while(0)
#define PC 0x10000u
#define SP 0x48000u
static int32_t call(uint32_t fn,uint16_t d1,int ok){
 m68k_write_memory_16(PC,0x4e4f);
 m68k_set_reg(M68K_REG_D0,fn);
 m68k_set_reg(M68K_REG_D1,d1);
 m68k_set_reg(M68K_REG_A7,SP);
 m68k_set_reg(M68K_REG_PC,PC);
 CHECK(pwp_mu_run(1)==2);
 CHECK(pwp_mu_dispatch()==(ok?1:2));
 CHECK(pwp_mu_pc()==PC+(ok?2:0));
 return (int32_t)pwp_mu_register(0);
}
static void hu_reset(void) {
 CHECK(pwp_mu_test_stage_byte(0,'H'));
 CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));
 CHECK(pwp_mu_load(80)==1);
}
int main(void){
 uint8_t v=0xff;
 hu_reset();
 CHECK(pwp_mu_iocs_gclr_calls()==0);
 CHECK(pwp_mu_graphics_display_enabled()==0);
 CHECK(pwp_mu_graphics_clear_count()==0);
 CHECK(pwp_bus_graphics_page()==0);
 CHECK(call(0x90,0,0)==0x90); /* fail-closed before CRTMOD */
 CHECK(pwp_mu_iocs_gclr_calls()==0);
 CHECK(pwp_bus_apply_crtmod10()); /* mode10 device baseline */
 /* Deliberately still absent _CRTMOD IOCS; device register alone insufficient. */
 CHECK(call(0x90,0,0)==0x90);
 CHECK(call(0x10,10,1)==0);
 CHECK(pwp_mu_iocs_crt_mode()==10);
 CHECK(pwp_bus_write8(0xc00001u,0x5a));
 CHECK(pwp_bus_read8(0xc00001u,&v) && v==0x5a);
 CHECK(pwp_bus_write8(0xe82001u,0x7e));
 CHECK(pwp_bus_write8(0xe82201u,0x7f));
 const uint32_t pixels=pwp_bus_pixel_mutations();
 CHECK(pixels>0);
 CHECK(call(0x90,0,1)==0);
 CHECK(pwp_mu_iocs_gclr_calls()==1);
 CHECK(pwp_mu_graphics_display_enabled()==1 && pwp_bus_graphics_page()==0);
 CHECK(pwp_bus_read8(0xc00001u,&v) && v==0);
 CHECK(pwp_bus_read8(0xe82001u,&v) && v==0);
 CHECK(pwp_bus_read8(0xe82201u,&v) && v==0x7f); /* text palette preserved */
 CHECK(pwp_bus_read8(0xe82601u,&v) && (v&1u));
 CHECK(pwp_bus_pixel_mutations()==pixels); /* init clearing NOT movie frame */
 CHECK(call(0x90,0,1)==0);
 CHECK(pwp_mu_graphics_clear_count()==2 && pwp_mu_iocs_gclr_calls()==2);
 CHECK(call(0x10,10,1)==0); /* CRTMOD disables graphics until next G_CLR_ON */
 CHECK(pwp_mu_graphics_display_enabled()==0);
 CHECK(call(0x90,0,1)==0);
 CHECK(pwp_mu_graphics_clear_count()==3);
 hu_reset();
 CHECK(pwp_mu_graphics_clear_count()==0);
 CHECK(pwp_mu_iocs_gclr_calls()==0);
 CHECK(pwp_mu_graphics_display_enabled()==0);
 CHECK(pwp_bus_read8(0xe82601u,&v) && v==0);
 puts("PASS FIX11 IOCS G_CLR_ON reset/VRAM/palette/display without false movie pixel claims (mock CPU only)");
 return 0;
}
