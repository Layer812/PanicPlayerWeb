/* R6 native DOS adapter contract tests. CPU is explicitly a synthetic mock. */
#include "m68k.h"
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void),pwp_mu_status(void);
extern void pwp_mu_set_pan_size(uint32_t,uint32_t);
extern uint32_t pwp_mu_console_length(void),pwp_mu_console_byte(uint32_t),pwp_mu_console_truncated(void),pwp_mu_exit_code(void);
extern unsigned int m68k_read_memory_32(unsigned int);
extern void m68k_write_memory_8(unsigned int,unsigned int),m68k_write_memory_16(unsigned int,unsigned int),m68k_write_memory_32(unsigned int,unsigned int);
#define ASSERT(x) do{if(!(x)){fprintf(stderr,"line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define CODE 0x10000u
#define SP 0x20000u
#define TEXT 0x24000u
static unsigned checks=0;
static void stage_long(unsigned addr,unsigned x){for(unsigned i=0;i<4;i++) ASSERT(pwp_mu_test_stage_byte(addr+i,(x>>(24-8*i))&255));}
static void load(void){
    ASSERT(pwp_mu_test_stage_byte(0,'H'));
    ASSERT(pwp_mu_test_stage_byte(1,'U'));
    stage_long(12,0x400);stage_long(16,0);stage_long(20,0x100);
    ASSERT(pwp_mu_load(64+0x400)==1);
    m68k_set_reg(M68K_REG_A7,SP);
}
static int32_t call(uint16_t op){
    m68k_write_memory_16(CODE,op);
    m68k_set_reg(M68K_REG_PC,CODE);
    ASSERT(pwp_mu_run(1)==2);++checks;
    return pwp_mu_dispatch();
}
static int32_t d0(void){return (int32_t)m68k_get_reg(NULL,M68K_REG_D0);}
static void arg16(unsigned ofs,unsigned value){m68k_write_memory_16(SP+ofs,value);}
static void arg32(unsigned ofs,unsigned value){m68k_write_memory_32(SP+ofs,value);}
int main(void){
    load();
    /* Firmware interrupt vector 0x70: RAM at 0x1c0; setter must return old. */
    arg16(0,0x70);arg32(2,0x11000);
    ASSERT(call(0xff25)==1 && d0()==0);
    ASSERT(m68k_read_memory_32(0x70*4)==0x11000);
    arg16(0,0x70);ASSERT(call(0xff35)==1 && d0()==0x11000);
    arg16(0,0x70);arg32(2,0x12000);
    ASSERT(call(0xff25)==1 && d0()==0x11000);
    /* Allow IOCS and DOS pseudo-vector table *storage* but not execution. */
    arg16(0,0x181);arg32(2,0x13000);
    ASSERT(call(0xff25)==1 && d0()==0);
    arg16(0,0x181);ASSERT(call(0xff35)==1 && d0()==0x13000);
    arg16(0,0xfff1);arg32(2,0x14000);
    ASSERT(call(0xff25)==1 && d0()==0);
    arg16(0,0xfff1);ASSERT(call(0xff35)==1 && d0()==0x14000);
    arg16(0,0x200);arg32(2,0x14000);
    ASSERT(call(0xff25)==1 && d0()==-14);
    arg16(0,0x200);ASSERT(call(0xff35)==1 && d0()==-14);
    arg16(0,0x70);arg32(2,0x400000);
    ASSERT(call(0xff25)==1 && d0()==-14);
    /* _PRINT output is bounded and byte-accurate; no JS logging from C. */
    const char* msg="PANIC ready\r\n";
    for(unsigned i=0;i<=strlen(msg);i++)m68k_write_memory_8(TEXT+i,(unsigned char)msg[i]);
    arg32(0,TEXT);
    ASSERT(call(0xff09)==1 && d0()==0);
    ASSERT(pwp_mu_console_length()==strlen(msg));
    for(unsigned i=0;i<strlen(msg);i++)ASSERT(pwp_mu_console_byte(i)==(unsigned char)msg[i]);
    arg32(0,0xffffffffu);
    ASSERT(call(0xff09)==1 && d0()==-14);
    ASSERT(pwp_mu_console_length()==strlen(msg));
    /* Explicit max buffer prevents host-side output amplification. */
    for(unsigned i=0;i<8300;i++)m68k_write_memory_8(TEXT+i,'X');
    m68k_write_memory_8(TEXT+8300,0);
    arg32(0,TEXT);
    ASSERT(call(0xff09)==1);
    ASSERT(pwp_mu_console_length()==8192 && pwp_mu_console_truncated()==1);
    /* SEEK from huge end must not invoke signed overflow. */
    pwp_mu_set_pan_size(0xffffffffu,0xffffffffu);
    for(unsigned i=0;i<10;i++)m68k_write_memory_8(TEXT+i,"P68K.PAN\0"[i]);
    arg32(0,TEXT);arg16(4,0);
    ASSERT(call(0xff3d)==1 && d0()==5);
    arg16(0,5);arg32(2,0);arg16(6,2);
    ASSERT(call(0xff42)==1 && d0()==-25);
    /* User mode exit and post-exit no-execution invariant. */
    arg16(0,0x7531);
    ASSERT(call(0xff4c)==4);
    ASSERT(pwp_mu_exit_code()==0x7531);
    ASSERT(pwp_mu_run(500)==4);
    ASSERT(pwp_mu_status()==4);
    load();
    ASSERT(pwp_mu_console_length()==0 && pwp_mu_console_truncated()==0);
    ASSERT(pwp_mu_exit_code()==0);
    arg16(0,0x70);ASSERT(call(0xff35)==1 && d0()==0);
    ASSERT(call(0xff00)==4 && pwp_mu_exit_code()==0);
    printf("PASS R6 mock adapter: %u synthetic DOS traps, not real 68000\n",checks);
    return 0;
}
