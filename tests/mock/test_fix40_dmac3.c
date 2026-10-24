/* FIX40: actual HD63450 channel-3 register semantics, no made-up DMA. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "pwp_x68k_video_bus.h"
#define BASE 0x00e840c0u
static uint8_t read8(uint32_t addr) {
  uint8_t v=0xeeu;
  assert(pwp_bus_read8(addr,&v)==1);
  return v;
}
static void write8(uint32_t addr,uint8_t value) {
  assert(pwp_bus_write8(addr,value)==1);
}
int main(void) {
  pwp_bus_reset();
  assert(pwp_bus_access8(BASE));
  assert(pwp_bus_writable8(BASE));
  assert(!pwp_bus_access8(BASE+2));
  assert(!pwp_bus_access8(0x00e84080u)); /* channel 2 not implemented */
  assert(!pwp_bus_access8(0x00e84100u)); /* outside DMA3 */
  assert(read8(BASE)==0); /* genuine idle CSR on reset */
  assert(read8(BASE+1u)==0); /* genuine idle CER */
  assert(pwp_bus_dmac3_csr_reads()==1);
  write8(BASE,0xffu);write8(BASE+1u,0xffu);
  assert(read8(BASE)==0);assert(read8(BASE+1u)==0);
  /* Hardware W1C must preserve live condition bits 0 and 3. */
  pwp_bus_test_dmac3_status(0xfbu,0x33u);
  write8(BASE,0xffu);
  write8(BASE+1u,0x13u);
  assert(read8(BASE)==0x09u);
  assert(read8(BASE+1u)==0x20u);
  /* HD63450 memory transfer counter: big endian byte order. */
  write8(BASE+0x0au,0x12u);write8(BASE+0x0bu,0x34u);
  assert(read8(BASE+0x0au)==0x12u && read8(BASE+0x0bu)==0x34u);
  /* 24-bit address register ignores uppermost byte. */
  write8(BASE+0x0cu,0xaau);write8(BASE+0x0du,0x12u);
  write8(BASE+0x0eu,0x34u);write8(BASE+0x0fu,0x56u);
  assert(read8(BASE+0x0cu)==0u);
  assert(read8(BASE+0x0du)==0x12u && read8(BASE+0x0fu)==0x56u);
  write8(BASE+0x07u,0x20u);assert(read8(BASE+0x07u)==0x20u);
  /* Never pretend a DMA start or CONTINUE has transferred audio. */
  assert(pwp_bus_write8(BASE+0x07u,0x80u)==0);
  assert(pwp_bus_write8(BASE+0x07u,0x40u)==0);
  assert(read8(BASE+0x07u)==0x20u);
  assert(pwp_bus_dmac3_start_rejections()==2u);
  assert(!pwp_bus_write8(BASE+2,0x88u));
  /* A new PAN resets guest device state and all evidence counters. */
  pwp_bus_reset();
  assert(read8(BASE)==0 && read8(BASE+1u)==0);
  assert(pwp_bus_dmac3_start_rejections()==0u);
  assert(pwp_bus_dmac3_write_count()==0u);
  puts("PASS FIX40: DMA3 idle CSR/CER W1C, register map, fail-closed STR/CNT");
  return 0;
}
