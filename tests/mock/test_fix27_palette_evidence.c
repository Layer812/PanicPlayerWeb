#include "pwp_x68k_video_bus.h"
#include "pwp_x68k_frame.h"
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#define REQ(x) do{if(!(x)){fprintf(stderr,"FAIL:%d %s\n",__LINE__,#x);exit(1);}}while(0)
static void poke(uint32_t a,uint8_t v){REQ(pwp_bus_write8(a,v));}
int main(void){
 pwp_bus_reset();REQ(pwp_bus_apply_crtmod10());REQ(pwp_bus_g_clr_on10());
 poke(0xe82601,1);
 REQ(pwp_bus_palette_word(0,0)==0);
 REQ(pwp_frame_render_mode10(256,256,0)==1);
 const uint8_t *px=(const uint8_t *)(uintptr_t)pwp_frame_pointer();
 REQ(px[0]==0&&px[1]==0&&px[2]==0);
 pwp_frame_set_palette0_evidence(1,0xdf70);
 REQ(pwp_frame_render_mode10(256,256,0)==1);
 REQ(px[0]==235&&px[1]==219&&px[2]==194);
 REQ(pwp_bus_palette_word(0,0)==0); /* guest MMIO untouched */
 poke(0xe82000,0x07);poke(0xe82001,0xc0);
 REQ(pwp_frame_render_mode10(256,256,0)==1);
 REQ(px[0]==251&&px[1]==0&&px[2]==0); /* guest GPal0 takes precedence */
 poke(0xe82000,0);poke(0xe82001,0);
 pwp_frame_set_palette0_evidence(0,0);
 REQ(pwp_frame_render_mode10(256,256,0)==1);
 REQ(px[0]==0&&px[1]==0&&px[2]==0);
 puts("PASS FIX27: evidence-only palette0, guest unchanged and guest override preserved");
 return 0;
}
