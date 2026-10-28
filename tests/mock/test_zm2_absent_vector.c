#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "m68k.h"
extern int32_t pwp_mu_load(uint32_t);
extern int pwp_mu_test_stage_byte(uint32_t,uint32_t);
extern unsigned int m68k_read_memory_32(unsigned int);
extern void m68k_write_memory_32(unsigned int,unsigned int);
extern uint32_t pwp_mu_guest_peek32(uint32_t);
#define CHECK(q) do{ if(!(q)){fprintf(stderr,"Z-MUSIC absent vector assertion failed at line %d: %s\n",__LINE__,#q);exit(1);} }while(0)
int main(void){
  /* Real HU setup with mock CPU, no fake resident and no driver binary. */
  CHECK(pwp_mu_test_stage_byte(0,'H'));
  CHECK(pwp_mu_test_stage_byte(1,'U'));
  CHECK(pwp_mu_test_stage_byte(15,16)); /* 16 byte HU text segment */
  CHECK(pwp_mu_load(80)==1);
  const uint32_t unhandled=m68k_read_memory_32(0x8cu);
  CHECK(unhandled>=0x00c00000u);
  CHECK(unhandled==0x00ff0000u);
  CHECK(pwp_mu_guest_peek32(0x8cu)==unhandled);
  /* panicCreationKitForWin x68/lib/zmusic.s zm_chk:
   * if vector >= 0x00c00000 then branch not-resident immediately.
   * No underflow to 0x00fffff8. */
  CHECK(!(unhandled<0x00c00000u));
  /* Real driver later can install a RAM vector. No fake signature is added. */
  m68k_write_memory_32(0x8cu,0x00020000u);
  CHECK(m68k_read_memory_32(0x8cu)==0x00020000u);
  /* Every new PAN load resets to the real "not resident" state. */
  CHECK(pwp_mu_load(80)==1);
  CHECK(m68k_read_memory_32(0x8cu)==unhandled);
  puts("PASS absent Z-MUSIC v2 probe cannot dereference 0xFFFFF8; trap3 stays replaceable");
  return 0;
}
