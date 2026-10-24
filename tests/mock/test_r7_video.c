/* R7: cross-check actual video bus + 68000 memory-call ABI with test-only CPU. */
#include "m68k.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "../../core/pwp_x68k_video_bus.h"
extern unsigned int m68k_read_memory_8(unsigned int);
extern unsigned int m68k_read_memory_16(unsigned int);
extern unsigned int m68k_read_memory_32(unsigned int);
extern void m68k_write_memory_8(unsigned int,unsigned int);
extern void m68k_write_memory_16(unsigned int,unsigned int);
extern void m68k_write_memory_32(unsigned int,unsigned int);
extern void pwp_mu_reset(void);
extern int32_t pwp_mu_status(void);
extern uint32_t pwp_mu_fault_address(void);
extern uint32_t pwp_mu_video_graphic_word(uint32_t,uint32_t);
extern uint32_t pwp_mu_video_text_index(uint32_t,uint32_t);
extern uint32_t pwp_mu_video_palette_word(uint32_t,uint32_t);
extern uint32_t pwp_mu_video_write_count(void);
#define C(x) do{if(!(x)){fprintf(stderr,"R7 CHECK FAILED line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
int main(void){
 pwp_mu_reset();
 /* First text bitplane and all four planes -> true indexed text pixels. */
 m68k_write_memory_8(0xe00000u,0x80u);
 C(m68k_read_memory_8(0xe00000u)==0x80u);
 C(pwp_mu_video_text_index(0,0)==1);
 C(pwp_mu_video_text_index(1,0)==0);
 m68k_write_memory_8(0xe20000u,0x80u);
 m68k_write_memory_8(0xe40000u,0x80u);
 m68k_write_memory_8(0xe60000u,0x80u);
 C(pwp_mu_video_text_index(0,0)==15);
 C(pwp_mu_video_text_index(1023,1023)==0);
 C(pwp_mu_video_text_index(1024,0)==0);
 /* CRTC #2a bit 0 => parallel write; #2b selects planes with bits 4..7. */
 m68k_write_memory_8(0xe8002au,0x01u);
 m68k_write_memory_8(0xe8002bu,0x50u);
 m68k_write_memory_8(0xe00000u,0x40u);
 C(pwp_mu_video_text_index(1,0)==5);
 C(m68k_read_memory_8(0xe00000u)==0x40u);
 C(m68k_read_memory_8(0xe20000u)==0x80u);
 C(m68k_read_memory_8(0xe40000u)==0x40u);
 /* PX68K GVRAM default 512px/16-color mode: 4 logical nibble pages. */
 m68k_write_memory_8(0xc00001u,0x03u);
 m68k_write_memory_8(0xc80001u,0x0au);
 m68k_write_memory_8(0xd00001u,0x06u);
 m68k_write_memory_8(0xd80001u,0x0cu);
 C(m68k_read_memory_8(0xc00001u)==3u);
 C(m68k_read_memory_8(0xc80001u)==10u);
 C(m68k_read_memory_8(0xd00001u)==6u);
 C(m68k_read_memory_8(0xd80001u)==12u);
 C(pwp_mu_video_graphic_word(0,0)==0xc6a3u);
 /* Palette is two-byte, big-endian, 256 registers per bank. */
 m68k_write_memory_16(0xe82202u,0x7fffu);
 C(m68k_read_memory_16(0xe82202u)==0x7fffu);
 C(pwp_mu_video_palette_word(1,1)==0x7fffu);
 C(pwp_mu_video_palette_word(1,0)==0);
 /* Unknown MMIO must fault, not return made-up device values. */
 C(pwp_mu_video_write_count()>0u);
 pwp_mu_reset();
 C(pwp_mu_video_write_count()==0u);
 C(pwp_mu_video_text_index(0,0)==0);
 C(pwp_mu_video_palette_word(1,1)==0);
 /* Preflight full length before 32-bit write that crosses unsupported MMIO. */
 m68k_write_memory_32(0xe823feu,0x10203040u);
 C(pwp_mu_status()==0);
 C(m68k_read_memory_32(0xe823feu)==0x10203040u); /* crosses into e82400 VCtrl */
 C(m68k_read_memory_8(0xe82400u)==0x30u);
 m68k_write_memory_32(0xe826feu,0xabcdef12u); /* cross to unmapped 0xe82700 */
 C(pwp_mu_video_write_count()==4u); /* 4 writes above, reset cleared earlier */
 C(pwp_mu_fault_address()==0xe826feu);
 m68k_write_memory_8(0xe90000u,0x77u);
 C(pwp_mu_fault_address()==0xe90000u);
 printf("PASS R7 guest video bus: TVRAM 4 planes, concurrent writes, palette, MMIO fails closed\n");
}
