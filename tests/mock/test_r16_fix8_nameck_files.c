#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t),pwp_mu_run(uint32_t),pwp_mu_dispatch(void);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern uint32_t pwp_mu_guest_peek8(uint32_t),pwp_mu_guest_peek32(uint32_t),pwp_mu_register(uint32_t),pwp_mu_pc(void);
extern void pwp_mu_set_pan_size(uint32_t,uint32_t);
extern void m68k_write_memory_8(unsigned,unsigned),m68k_write_memory_16(unsigned,unsigned),m68k_write_memory_32(unsigned,unsigned);
#define CHECK(x) do {if(!(x)){fprintf(stderr,"FAIL LINE %d: %s\n",__LINE__,#x);exit(1);}}while(0)
#define PC 0x10000u
#define SP 0x50000u
#define FILE_PTR 0x40000u
#define BUF 0x48000u
static void textat(uint32_t addr, const char *s){
  do {m68k_write_memory_8(addr++,(uint8_t)*s);} while(*s++);
}
static void setstack(uint32_t name,uint32_t out){
  m68k_write_memory_32(SP,name);
  m68k_write_memory_32(SP+4,out);
  m68k_set_reg(M68K_REG_A7,SP);
}
static int32_t call(uint16_t op){
  m68k_write_memory_16(PC,op);m68k_set_reg(M68K_REG_PC,PC);
  CHECK(pwp_mu_run(1)==2);
  int32_t rc=pwp_mu_dispatch();
  CHECK(rc==1 || rc==2);
  if(rc==1)CHECK(pwp_mu_pc()==PC+2);
  return rc;
}
static uint32_t be32(uint32_t addr){return pwp_mu_guest_peek32(addr);}
int main(void){
  CHECK(pwp_mu_test_stage_byte(0,'H'));CHECK(pwp_mu_test_stage_byte(1,'U'));
  CHECK(pwp_mu_test_stage_byte(15,16));CHECK(pwp_mu_load(80)==1);
  pwp_mu_set_pan_size(0,54272);
  textat(FILE_PTR,"C:\\P68K.PAN");
  setstack(FILE_PTR,BUF);CHECK(call(0xff37)==1);
  CHECK(pwp_mu_register(0)==0);
  CHECK(pwp_mu_guest_peek8(BUF)=='C');CHECK(pwp_mu_guest_peek8(BUF+1)==':');
  CHECK(pwp_mu_guest_peek8(BUF+2)=='\\');CHECK(pwp_mu_guest_peek8(BUF+3)==0);
  const char base[]="P68K", ext[]=".PAN";
  for(unsigned i=0;i<sizeof(base);i++)CHECK(pwp_mu_guest_peek8(BUF+67+i)==(uint8_t)base[i]);
  for(unsigned i=0;i<sizeof(ext);i++)CHECK(pwp_mu_guest_peek8(BUF+86+i)==(uint8_t)ext[i]);
  CHECK(pwp_mu_guest_peek8(BUF+90)==0);
  /* NAMECK accepts case-insensitive C:\\ and filename, without changing its source. */
  textat(FILE_PTR,"c:/p68k.pan");setstack(FILE_PTR,BUF);CHECK(call(0xff37)==1);
  CHECK(pwp_mu_guest_peek8(BUF)=='C');CHECK(pwp_mu_guest_peek8(BUF+67)=='P');
  CHECK(pwp_mu_guest_peek8(FILE_PTR)=='c');
  /* Invalid target must not write even the first destination byte. */
  textat(FILE_PTR,"C:\\P68K.PAN");
  m68k_write_memory_8(BUF,0xa5);
  setstack(FILE_PTR,0x3fffffu-60u);
  CHECK(call(0xff37)==1);CHECK((int32_t)pwp_mu_register(0)==-14);
  CHECK(pwp_mu_guest_peek8(BUF)==0xa5);
  /* Reject another drive and wildcards; do not fabricate success. */
  textat(FILE_PTR,"D:\\P68K.PAN");setstack(FILE_PTR,BUF);
  CHECK(call(0xff37)==1);CHECK((int32_t)pwp_mu_register(0)==-15);
  textat(FILE_PTR,"C:\\*.PAN");setstack(FILE_PTR,BUF);
  CHECK(call(0xff37)==1);CHECK((int32_t)pwp_mu_register(0)==-13);
  /* FILES: real 53-byte guest metadata for ONE mounted virtual file. */
  textat(FILE_PTR,"C:\\P68K.PAN");
  m68k_write_memory_32(SP,BUF);
  m68k_write_memory_32(SP+4,FILE_PTR);
  m68k_write_memory_16(SP+8,0x20);
  m68k_set_reg(M68K_REG_A7,SP);
  CHECK(call(0xff4e)==1);CHECK(pwp_mu_register(0)==0);
  CHECK(pwp_mu_guest_peek8(BUF+21)==0x20);
  CHECK(be32(BUF+26)==54272);
  const char path[]="P68K.PAN";
  for(unsigned i=0;i<sizeof(path);i++)CHECK(pwp_mu_guest_peek8(BUF+30+i)==(uint8_t)path[i]);
  CHECK(pwp_mu_guest_peek8(BUF+52)==0);
  /* No second host file leaks through virtual search. */
  m68k_write_memory_32(SP,BUF);
  CHECK(call(0xff4f)==1);CHECK((int32_t)pwp_mu_register(0)==-18);
  textat(FILE_PTR,"C:\\NOFILE.PAN");m68k_write_memory_32(SP,BUF);
  m68k_write_memory_32(SP+4,FILE_PTR);m68k_write_memory_16(SP+8,0x20);
  CHECK(call(0xff4e)==1);CHECK((int32_t)pwp_mu_register(0)==-18);
  /* _OPEN sees only the virtual PAN path, no arbitrary host pathname. */
  textat(FILE_PTR,"C:\\P68K.PAN");m68k_write_memory_32(SP,FILE_PTR);
  m68k_write_memory_16(SP+4,0);CHECK(call(0xff3d)==1);
  CHECK(pwp_mu_register(0)==5);
  puts("PASS R16 FIX8 NAMECK(91) FILES(53) NFILES and virtual-only OPEN; MOCK CPU ONLY");
  return 0;
}
