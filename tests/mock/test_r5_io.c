/* R5 native test-double ABI, NOT Musashi CPU execution */
#include "m68k.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void),pwp_mu_status(void),pwp_mu_supply_read(uint32_t);
extern void pwp_mu_set_pan_size(uint32_t,uint32_t);
extern uint32_t pwp_mu_pan_error_count(void),pwp_mu_pan_error_op(void);
extern int32_t pwp_mu_pan_error_code(void);
extern uint32_t pwp_mu_pan_read_calls(void),pwp_mu_pan_open_calls(void),pwp_mu_pan_bytes_low(void),pwp_mu_pan_bytes_high(void),pwp_mu_pan_open(void);
extern uint32_t pwp_mu_io_length(void),pwp_mu_io_offset_high(void),pwp_mu_io_offset_low(void),pwp_mu_io_capacity(void);
extern uint32_t pwp_mu_guest_peek32(uint32_t);
extern void m68k_write_memory_8(unsigned int,unsigned int),m68k_write_memory_16(unsigned int,unsigned int),m68k_write_memory_32(unsigned int,unsigned int);
extern unsigned int m68k_read_memory_8(unsigned int),m68k_read_memory_16(unsigned int),m68k_read_memory_32(unsigned int);
#define CHECK(x) do{ if(!(x)){fprintf(stderr,"FAIL line %d: %s\n",__LINE__,#x);exit(1);} }while(0)
#define CODE 0x10000u
#define SP 0x20000u
#define PATH 0x30000u
#define DST 0x40000u
static unsigned count;
static void test_byte(unsigned addr,unsigned value){CHECK(pwp_mu_test_stage_byte(addr,value));}
static void test_long(unsigned at,unsigned value){for(int i=0;i<4;i++)test_byte(at+i,(value>>(24-8*i))&0xff);}
static int32_t call(uint16_t op){
  m68k_write_memory_16(CODE,op);
  m68k_set_reg(M68K_REG_PC,CODE);
  CHECK(pwp_mu_run(1)==2);
  ++count;
  return pwp_mu_dispatch();
}
static int32_t d0(void){return (int32_t)m68k_get_reg(NULL,M68K_REG_D0);}
static void arg16(unsigned o,unsigned v){m68k_write_memory_16(SP+o,v);}
static void arg32(unsigned o,unsigned v){m68k_write_memory_32(SP+o,v);}
static void path(const char *x){for(unsigned i=0;i<=strlen(x);i++)m68k_write_memory_8(PATH+i,(unsigned char)x[i]);}
static void open_pan(void){arg32(0,PATH);arg16(4,0);CHECK(call(0xff3d)==1);CHECK(d0()==5);}
static void close_pan(void){arg16(0,5);CHECK(call(0xff3e)==1);CHECK(d0()==0);}
int main(void){
  /* Load minimal HU payload (fake program, not emulated by the mock). */
  test_byte(0,'H');test_byte(1,'U');
  test_long(12,0x400);test_long(16,0);test_long(20,0x100);
  test_byte(64,0x4e);test_byte(65,0x71);
  CHECK(pwp_mu_load(64+0x400)==1);
  m68k_set_reg(M68K_REG_A7,SP);
  CHECK(pwp_mu_pan_read_calls()==0 && pwp_mu_pan_bytes_low()==0 && pwp_mu_pan_open_calls()==0);
  CHECK(pwp_mu_pan_error_count()==0);
  path("P68K.PAN");
  arg32(0,PATH);arg16(4,0);
  CHECK(call(0xff3d)==1);CHECK(d0()==-2); /* fail closed: not mounted */
  CHECK(pwp_mu_pan_error_count()==1 && pwp_mu_pan_error_op()==0xff3d && pwp_mu_pan_error_code()==-2);
  pwp_mu_set_pan_size(0,130000);
  path("../P68K.PAN");CHECK(call(0xff3d)==1);CHECK(d0()==-2);
  path("A:\\SUB\\P68K.PAN");CHECK(call(0xff3d)==1);CHECK(d0()==-2);
  path("P68K.PAN");arg16(4,2);CHECK(call(0xff3d)==1);CHECK(d0()==-12);
  arg16(4,0);open_pan();
  CHECK(pwp_mu_pan_open_calls()==1 && pwp_mu_pan_open()==1);
  CHECK(call(0xff3d)==1);CHECK(d0()==-4); /* second simultaneous open denied */
  arg16(0,42);CHECK(call(0xff3e)==1);CHECK(d0()==-6);
  /* Invalid buffer must not execute pending host read. */
  arg16(0,5);arg32(2,0x3ffffe);arg32(6,4);
  CHECK(call(0xff3f)==1);CHECK(d0()==-22);
  arg16(0,5);arg32(2,DST);arg32(6,130000);
  CHECK(call(0xff3f)==3);CHECK(pwp_mu_io_length()==65536);CHECK(pwp_mu_io_capacity()==65536);
  CHECK(pwp_mu_pan_read_calls()==1 && pwp_mu_pan_bytes_low()==0);
  CHECK(pwp_mu_io_offset_low()==0 && pwp_mu_io_offset_high()==0);
  CHECK(pwp_mu_supply_read(65537)==-12);
  /* Deliberate fail-closed contract requires fresh process for further checks. */
  CHECK(pwp_mu_load(64+0x400)==1);
  m68k_set_reg(M68K_REG_A7,SP);
  pwp_mu_set_pan_size(0,130000);path("C:\\P68K.PAN");open_pan();
  arg16(0,5);arg32(2,DST);arg32(6,130000);
  CHECK(call(0xff3f)==3);
  for(unsigned i=0;i<65536;i++)test_byte(i,i&255);
  CHECK(pwp_mu_supply_read(65536)==3);
  CHECK(pwp_mu_pan_bytes_low()==65536 && pwp_mu_pan_bytes_high()==0);
  CHECK(pwp_mu_io_offset_low()==65536);CHECK(pwp_mu_io_length()==64464);
  for(unsigned i=0;i<64464;i++)test_byte(i,(i+7)&255);
  CHECK(pwp_mu_supply_read(64464)==1);
  CHECK(pwp_mu_pan_bytes_low()==130000 && pwp_mu_pan_read_calls()==1);
  CHECK(d0()==130000);
  CHECK(m68k_read_memory_8(DST)==0);
  CHECK(m68k_read_memory_8(DST+65535)==255);
  CHECK(m68k_read_memory_8(DST+65536)==7);
  CHECK(m68k_read_memory_8(DST+129999)==((64463+7)&255));
  /* Already at EOF, no callback must be scheduled. */
  arg16(0,5);arg32(2,DST);arg32(6,200);
  CHECK(call(0xff3f)==1);CHECK(d0()==0);
  /* Seek from start to middle, read until EOF. */
  arg16(0,5);arg32(2,129999);arg16(6,0);
  CHECK(call(0xff42)==1);CHECK(d0()==129999);
  arg16(0,5);arg32(2,DST);arg32(6,200);
  CHECK(call(0xff3f)==3);CHECK(pwp_mu_io_length()==1);
  test_byte(0,0x3a);CHECK(pwp_mu_supply_read(1)==1);CHECK(d0()==1);
  CHECK(pwp_mu_pan_bytes_low()==130001 && pwp_mu_pan_read_calls()==3);
  CHECK(m68k_read_memory_8(DST)==0x3a);
  /* Invalid negative absolute seek -> DOS error. */
  arg16(0,5);arg32(2,0xffffffffu);arg16(6,0);
  CHECK(call(0xff42)==1);CHECK(d0()==-25);
  /* Human68k does not permit seek beyond end-of-file. */
  arg16(0,5);arg32(2,130001);arg16(6,0);
  CHECK(call(0xff42)==1);CHECK(d0()==-25);
  /* Zero-byte _READ succeeds, must not mutate read-only PAN. */
  arg16(0,5);arg32(2,DST);arg32(6,0);
  CHECK(call(0xff3f)==1);CHECK(d0()==0); /* zero bytes */
  close_pan();CHECK(pwp_mu_pan_open()==0);
  /* Initial process owns all memory until it releases its tail. */
  arg32(0,0xffffffffu);CHECK(call(0xff48)==1);CHECK(d0()==0);
  arg32(0,0x10000);arg32(4,0x30000);
  CHECK(call(0xff4a)==1);CHECK(d0()==0);
  CHECK(pwp_mu_guest_peek32(0xfff8)==0x40000);
  arg32(0,0xffffffffu);CHECK(call(0xff48)==1);
  CHECK(d0()==(int32_t)(0x3f0000-0x40000-16));
  arg32(0,0x100);CHECK(call(0xff48)==1);CHECK(d0()==0x40010);
  CHECK(pwp_mu_guest_peek32(0xfffc)==0x40000);
  CHECK(pwp_mu_guest_peek32(0x40000)==0xfff0);
  CHECK(pwp_mu_guest_peek32(0x40008)==0x40110);
  arg32(0,0x100);CHECK(call(0xff48)==1);CHECK(d0()==0x40120);
  CHECK(pwp_mu_guest_peek32(0x4000c)==0x40110);
  arg32(0,0x40010);CHECK(call(0xff49)==1);CHECK(d0()==0);
  CHECK(pwp_mu_guest_peek32(0xfffc)==0x40110);
  arg32(0,0x80);CHECK(call(0xff48)==1);CHECK(d0()==0x40010);
  arg32(0,0x3f0000);arg32(4,0x10000);
  CHECK(call(0xff4a)==1);CHECK(d0()==-8); /* no overlap */
  /* Unsupported services must remain blocked. */
  CHECK(call(0xff70)==2);
  CHECK(pwp_mu_status()==2);
  printf("PASS R5 native mock DOS I/O adapter assertions (%u synthetic trap cases, NOT Musashi CPU)\n",count);
  return 0;
}
