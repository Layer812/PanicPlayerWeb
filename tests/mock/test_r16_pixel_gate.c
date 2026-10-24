/* R16: actual guest bus mutations, never claim a frame from palette-only MMIO.
 * This is an isolated test-only CPU register mock, NOT a 68000 execution test. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "../../core/pwp_x68k_video_bus.h"
extern void pwp_mu_reset(void);
extern void m68k_write_memory_8(unsigned int,unsigned int);
extern void m68k_write_memory_16(unsigned int,unsigned int);
extern uint32_t pwp_mu_video_pixel_writes(void);
extern uint32_t pwp_mu_video_write_count(void);
#define C(e) do{if(!(e)){fprintf(stderr,"R16 pixel counter FAIL line %d: %s\n",__LINE__,#e);exit(1);}}while(0)
int main(void){
 pwp_mu_reset();
 C(pwp_mu_video_pixel_writes()==0);
 m68k_write_memory_8(0xe80028u,0x01u); /* CRTC: must not count as pixel */
 m68k_write_memory_16(0xe82002u,0xffffu); /* GRB palette */
 C(pwp_mu_video_pixel_writes()==0);
 C(pwp_mu_video_write_count()==3u);
 m68k_write_memory_8(0xe00000u,0x00u); /* text unchanged */
 C(pwp_mu_video_pixel_writes()==0);
 m68k_write_memory_8(0xe00000u,0x80u);
 C(pwp_mu_video_pixel_writes()==1u);
 m68k_write_memory_8(0xe00000u,0x80u); /* same value must not count */
 C(pwp_mu_video_pixel_writes()==1u);
 m68k_write_memory_8(0xc00000u,0x07u); /* GVRAM even bytes in 16-color mode ignored */
 C(pwp_mu_video_pixel_writes()==1u);
 m68k_write_memory_8(0xc00001u,0x03u);
 C(pwp_mu_video_pixel_writes()==2u);
 m68k_write_memory_8(0xc00001u,0x03u);
 C(pwp_mu_video_pixel_writes()==2u);
 m68k_write_memory_8(0xc00001u,0x04u);
 C(pwp_mu_video_pixel_writes()==3u);
 pwp_mu_reset();
 C(pwp_mu_video_pixel_writes()==0);
 C(pwp_mu_video_write_count()==0);
 puts("PASS R16 video: unchanged pixels and register-only writes do not claim first frame");
}
