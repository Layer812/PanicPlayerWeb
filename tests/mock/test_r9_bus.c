/* R9 bus hardening test against the real C bridge, synthetic CPU registers.
 * NOT a Musashi CPU test: does not execute 68000 instructions. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "../../core/pwp_x68k_video_bus.h"
extern void pwp_mu_reset(void);
extern int32_t pwp_mu_status(void);
extern uint32_t pwp_mu_fault_address(void);
extern unsigned int m68k_read_memory_8(unsigned int);
extern unsigned int m68k_read_memory_16(unsigned int);
extern void m68k_write_memory_8(unsigned int,unsigned int);
extern void m68k_write_memory_16(unsigned int,unsigned int);
extern void m68k_write_memory_32(unsigned int,unsigned int);
#define CHECK(x) do {if (!(x)) {fprintf(stderr,"R9 bus line %d: %s\n",__LINE__,#x);exit(1);}} while (0)
int main(void) {
  pwp_mu_reset();
  /* 68000 external A0..A23 only; aliases must reach the same physical RAM. */
  m68k_write_memory_8(0x01001000u, 0xa5u);
  CHECK(m68k_read_memory_8(0x00001000u) == 0xa5u);
  m68k_write_memory_16(0x02001002u, 0x12f3u);
  CHECK(m68k_read_memory_16(0x00001002u) == 0x12f3u);
  m68k_write_memory_8(0x01e00000u, 0x80u);
  CHECK(pwp_bus_text_index(0,0)==1u);
  m68k_write_memory_16(0x01e82200u,0x7fffu);
  CHECK(pwp_bus_palette_word(0,1)==0x7fffu);
  CHECK(pwp_mu_status()==0);
  /* Illegal MMIO crossing must not partially commit earlier CRTC bytes. */
  m68k_write_memory_32(0xe8002eu, 0x12345678u);
  CHECK(pwp_mu_fault_address()==0xe8002eu);
  CHECK(pwp_bus_crtc_register(0x2e)==0u);
  CHECK(pwp_bus_crtc_register(0x2f)==0u);
  /* A legal 32-bit CRTC write is atomic with regard to validation. */
  m68k_write_memory_32(0xe80028u,0x12345678u);
  CHECK(pwp_bus_crtc_register(0x28)==0x12u);
  CHECK(pwp_bus_crtc_register(0x29)==0x34u);
  CHECK(pwp_bus_crtc_register(0x2a)==0x56u);
  CHECK(pwp_bus_crtc_register(0x2b)==0x78u);
  /* No guessing at unsupported 0xe90000 hardware. */
  m68k_write_memory_8(0x01e90000u,0xffu);
  CHECK(pwp_mu_fault_address()==0x01e90000u);
  puts("PASS R9 real C bus: 24-bit aliases + atomic MMIO preflight, mock CPU only");
  return 0;
}
