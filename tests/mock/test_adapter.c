#include "m68k.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
extern uint32_t pwp_mu_stage_ptr(void),pwp_mu_stage_capacity(void);
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void),pwp_mu_status(void);
extern uint32_t pwp_mu_trap(void),pwp_mu_pc(void),pwp_mu_trap_pc(void),pwp_mu_guest_peek32(uint32_t);
extern unsigned int m68k_read_memory_16(unsigned int),m68k_read_memory_32(unsigned int);
extern void m68k_write_memory_32(unsigned int,unsigned int);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
static void stage_be32(uint32_t pos,uint32_t value){
 for(int i=0;i<4;i++) pwp_mu_test_stage_byte(pos+i,(value>>(24-8*i))&0xff);
}
#define CHECK(e) do{if(!(e)){fprintf(stderr,"FAIL line %u: %s\n",__LINE__,#e);exit(1);}}while(0)
int main(void){
 CHECK(pwp_mu_stage_capacity()>=15412);
 /* The stage address is a wasm32 pointer in production, but a native mock
  * pointer is 64-bit; skip access and use the test-loader fixture below. */
 (void)pwp_mu_stage_ptr;
 CHECK(pwp_mu_load(0)==-1);CHECK(pwp_mu_status()==-1);
 CHECK(m68k_read_memory_16(0x410000)==0);
 /* Test memory write/get callbacks (reset+HU loading is verified separately
  * by R3 tests, the mock intentionally cannot exercise true CPU opcodes). */
 m68k_write_memory_32(0x10000,0x4dfa3bf2);
 CHECK(m68k_read_memory_32(0x10000)==0x4dfa3bf2);
 CHECK(m68k_read_memory_16(0x10000)==0x4dfa);
 /* The real image layout with test-only HU payload. */
 CHECK(pwp_mu_test_stage_byte(0,'H'));CHECK(pwp_mu_test_stage_byte(1,'U'));
 stage_be32(12,0x39a2);stage_be32(16,0x252);stage_be32(20,0x1772);
 CHECK(pwp_mu_test_stage_byte(64,0xff));CHECK(pwp_mu_test_stage_byte(65,0x4a));
 CHECK(pwp_mu_load(15412)==1);
 CHECK(pwp_mu_guest_peek32(0xfff8)==0x3f0000); /* initial MCB end */
 m68k_set_reg(M68K_REG_PC,0x10000);
 m68k_set_reg(M68K_REG_A7,0x20000);
 m68k_write_memory_32(0x20000,0x10000);
 m68k_write_memory_32(0x20004,0x200000);
 CHECK(pwp_mu_run(1)==2);
 CHECK(pwp_mu_trap()==0xff4a);CHECK(pwp_mu_trap_pc()==0x10000);
 CHECK(pwp_mu_dispatch()==1);
 CHECK(pwp_mu_pc()==0x10002);
 CHECK(pwp_mu_guest_peek32(0xfff8)==0x210000); /* resized MCB */
 CHECK(m68k_get_reg(NULL,M68K_REG_D0)==0);
 /* Undocumented DOS operations must STOP instead of pretending success. */
 m68k_write_memory_32(0x10004,0xff700000);
 m68k_set_reg(M68K_REG_PC,0x10004);
 CHECK(pwp_mu_run(1)==2);CHECK(pwp_mu_trap()==0xff70);
 CHECK(pwp_mu_dispatch()==2);
 puts("PASS R4 mock adapter bus ABI / invalid load checks (NOT Musashi CPU test)");
 return 0;
}
