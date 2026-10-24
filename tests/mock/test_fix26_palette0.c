/* FIX26 direct C guest bus -> real RGBA raster regression.
   No fabricated frame images, synthetic memory writes are used ONLY for tests. */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "pwp_x68k_video_bus.h"
#include "pwp_x68k_frame.h"
#define CHK(x) do {if(!(x)){fprintf(stderr,"FIX26 C assertion failed line %d: %s\n",__LINE__,#x);return 1;}}while(0)
static void pal(uint32_t base,uint32_t idx,uint16_t c) {
  if(!pwp_bus_write8(base+2*idx,(uint8_t)(c>>8)) ||
     !pwp_bus_write8(base+2*idx+1,(uint8_t)c))abort();
}
int main(void){
 pwp_bus_reset();CHK(pwp_bus_apply_crtmod10());CHK(pwp_bus_g_clr_on10());
 // TEXT[0] is black; visible graphics pixel index 0 has been explicitly
 // set to white. The renderer must not replace this with TEXT[0].
 pal(0xe82000,0,0xfffe);pal(0xe82200,0,0x0000);
 CHK(pwp_bus_palette_word(0,0)==0xfffe);
 CHK(pwp_bus_palette_word(0,1)==0x0000);
 CHK(pwp_frame_render_mode10(256,256,1));
 uint8_t *image=(uint8_t*)pwp_frame_pointer();
 CHK(pwp_frame_size()==256u*256u*4u);
 CHK(image[0]>=250&&image[1]>=250&&image[2]>=250&&image[3]==255);
 // 1.38-style G0 graphics can explicitly override its palette index 0.
 CHK(pwp_bus_write8(0xc00001,0x01));pal(0xe82000,1,0x07c0);
 CHK(pwp_frame_render_mode10(256,256,1));image=(uint8_t*)pwp_frame_pointer();
 CHK(image[0]>=250&&image[1]<5&&image[2]<5);  // G0 index1 red
 CHK(image[4]>=250&&image[5]>=250&&image[6]>=250); // Next index0 white
 // When graphics are OFF, retain existing text/background color selection.
 CHK(pwp_bus_write8(0xe82601,0x20));
 CHK(pwp_frame_render_mode10(256,256,1));image=(uint8_t*)pwp_frame_pointer();
 CHK(image[0]==0&&image[1]==0&&image[2]==0);
 puts("PASS FIX26 C palette0 foreground, G0 pix index1, graphics-off black");
 return 0;
}
