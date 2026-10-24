/* Native C IOCS transport test. Uses a stub register bank only.
 * This is NOT a real Musashi execution test. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_audio_serial(void),pwp_mu_audio_kind(void),pwp_mu_audio_chain_addr(void);
extern uint32_t pwp_mu_audio_chain_count(void),pwp_mu_audio_mode(void),pwp_mu_audio_chain_calls(void);
extern uint32_t pwp_mu_audio_control_calls(void);
extern void m68k_write_memory_8(unsigned,unsigned),m68k_write_memory_16(unsigned,unsigned);
#define CHECK(x) do{if(!(x)){fprintf(stderr,"FAIL FIX29:%u %s\n",__LINE__,#x);exit(1);}}while(0)
static void prep(void){
 CHECK(pwp_mu_test_stage_byte(0,'H'));CHECK(pwp_mu_test_stage_byte(1,'U'));
 CHECK(pwp_mu_test_stage_byte(15,16));CHECK(pwp_mu_load(80)==1);
}
static int32_t call(unsigned fn,unsigned d1,unsigned d2,unsigned a1){
 m68k_write_memory_16(0x10000,0x4e4f);
 m68k_set_reg(M68K_REG_PC,0x10000);m68k_set_reg(M68K_REG_A7,0x48000);
 m68k_set_reg(M68K_REG_D0,fn);m68k_set_reg(M68K_REG_D1,d1);
 m68k_set_reg(M68K_REG_D2,d2);m68k_set_reg(M68K_REG_A1,a1);
 CHECK(pwp_mu_run(1)==2);
 return pwp_mu_dispatch();
}
int main(void){
 prep();CHECK(pwp_mu_audio_serial()==0);
 CHECK(call(0x67,0,0,0)==1);CHECK(pwp_mu_audio_serial()==1 && pwp_mu_audio_kind()==0);
 CHECK(call(0x67,1,0,0)==1);CHECK(pwp_mu_audio_serial()==2 && pwp_mu_audio_kind()==1);
 CHECK(call(0x67,2,0,0)==1);CHECK(pwp_mu_audio_serial()==3 && pwp_mu_audio_kind()==2);
 CHECK(call(0x67,3,0,0)==1);CHECK(pwp_mu_audio_serial()==3); /* invalid mode -> -1 */
 CHECK(pwp_mu_audio_control_calls()==3);
 const uint32_t table=0x50000, data=0x51000;
 m68k_write_memory_8(table,0);m68k_write_memory_8(table+1,5);
 m68k_write_memory_8(table+2,0x10);m68k_write_memory_8(table+3,0);
 m68k_write_memory_8(table+4,0);m68k_write_memory_8(table+5,3);
 m68k_write_memory_8(data,1);m68k_write_memory_8(data+1,0x78);
 m68k_write_memory_8(data+2,0x9f);
 CHECK(call(0x62,0x403,1,table)==1);
 CHECK(pwp_mu_audio_serial()==4 && pwp_mu_audio_kind()==3);
 CHECK(pwp_mu_audio_chain_calls()==1 && pwp_mu_audio_chain_addr()==table);
 CHECK(pwp_mu_audio_chain_count()==1 && pwp_mu_audio_mode()==0x403);
 CHECK(call(0x62,0x703,1,table)==2); /* unsupported rate stays blocked */
 CHECK(pwp_mu_audio_serial()==4);
 prep();CHECK(pwp_mu_audio_serial()==0 && pwp_mu_audio_chain_calls()==0);
 puts("PASS FIX29 ADPCMMOD/ADPCMAOT register, descriptor, reset and validation (mock CPU only)");
 return 0;
}
