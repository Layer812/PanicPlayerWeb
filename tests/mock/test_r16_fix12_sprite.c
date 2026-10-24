/* Test memory-backed CYNTHIA subset and IOCS API with mock Musashi. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
#include "pwp_x68k_video_bus.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_register(uint32_t),pwp_mu_pc(void),pwp_mu_iocs_sp_init_calls(void),pwp_mu_iocs_sp_on_calls(void);
extern void m68k_write_memory_16(unsigned,unsigned);
#define CHECK(x) do{if(!(x)){fprintf(stderr,"FAIL FIX12 line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define PC 0x10000u
#define SP 0x48000u
static int32_t call(uint32_t fn,uint32_t d1){
 m68k_write_memory_16(PC,0x4e4f);
 m68k_set_reg(M68K_REG_D0,fn);m68k_set_reg(M68K_REG_D1,d1);m68k_set_reg(M68K_REG_A7,SP);m68k_set_reg(M68K_REG_PC,PC);
 CHECK(pwp_mu_run(1)==2);
 CHECK(pwp_mu_dispatch()==1);
 CHECK(pwp_mu_pc()==PC+2);
 return (int32_t)pwp_mu_register(0);
}
static void reset(void){
 CHECK(pwp_mu_test_stage_byte(0,'H'));
 CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));
 CHECK(pwp_mu_load(80)==1);
}
int main(void){
 uint8_t v=0xff;
 reset();
 CHECK(call(0xc0,0)==-1 && call(0xc1,0)==-1);
 CHECK(!pwp_bus_sprite_initialized() && !pwp_bus_sprite_display_enabled());
 CHECK(call(0x10,10)==0);
 CHECK(call(0xc1,0)==-1); /* sprite must first be initialized */
 CHECK(pwp_bus_write8(0xc00001u,0x77));
 CHECK(pwp_bus_write8(0xe82001u,0x44));
 CHECK(pwp_bus_write8(0xe82201u,0x55));
 CHECK(pwp_bus_write8(0xeb0000u,0xa1));
 CHECK(pwp_bus_write8(0xeb03ffu,0xa2));
 CHECK(pwp_bus_write8(0xeb0800u,0xa3));
 CHECK(pwp_bus_write8(0xeb0811u,0xa4));
 CHECK(pwp_bus_write8(0xeb8000u,0xa5));
 CHECK(pwp_bus_write8(0xebffffu,0xa6));
 CHECK(!pwp_bus_access8(0xeb0400u));
 CHECK(!pwp_bus_access8(0xeb0812u));
 CHECK(!pwp_bus_access8(0xeb7fffu));
 const uint32_t pixels=pwp_bus_pixel_mutations();
 CHECK(pixels>0);
 CHECK(call(0xc0,0)==0);
 CHECK(pwp_mu_iocs_sp_init_calls()==1 && pwp_bus_sprite_initializations()==1);
 CHECK(pwp_bus_sprite_initialized() && !pwp_bus_sprite_display_enabled());
 const uint32_t addr[]={0xeb0000u,0xeb03ffu,0xeb0800u,0xeb0811u,0xeb8000u,0xebffffu,0xe82201u};
 for(unsigned i=0;i<sizeof(addr)/sizeof(addr[0]);i++)CHECK(pwp_bus_read8(addr[i],&v) && v==0);
 CHECK(pwp_bus_read8(0xc00001u,&v) && v==0x77);
 CHECK(pwp_bus_read8(0xe82001u,&v) && v==0x44);
 CHECK(pwp_bus_pixel_mutations()==pixels); /* init is NOT movie drawing */
 CHECK(call(0xc1,0)==0);
 CHECK(pwp_mu_iocs_sp_on_calls()==1 && pwp_bus_sprite_display_enabled());
 CHECK(pwp_bus_read8(0xe82601u,&v) && (v&0x40u));
 CHECK(call(0xc0,0)==0); /* repeat INIT clears enable */
 CHECK(!pwp_bus_sprite_display_enabled());
 CHECK(pwp_bus_read8(0xe82601u,&v) && !(v&0x40u));
 CHECK(call(0xc1,0)==0 && pwp_bus_sprite_enables()==2);
 reset();
 CHECK(!pwp_bus_sprite_initialized() && !pwp_bus_sprite_display_enabled());
 CHECK(pwp_mu_iocs_sp_init_calls()==0 && pwp_mu_iocs_sp_on_calls()==0);
 CHECK(!pwp_bus_sprite_initializations() && !pwp_bus_sprite_enables());
 CHECK(pwp_bus_read8(0xebffffu,&v) && v==0);
 puts("PASS FIX12 sprite/BG IOCS initialization and ON, hardware backing reset (mock CPU only)");
 return 0;
}
