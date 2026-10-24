#include <stdint.h>
#include <stdio.h>
#include <assert.h>
#include "pwp_x68k_frame.h"
#include "pwp_x68k_video_bus.h"
#define W(a,v) assert(pwp_bus_write8((a),(v)))
int main(void){
 pwp_bus_reset();assert(pwp_bus_apply_crtmod10());assert(pwp_bus_g_clr_on10());
 W(0xe82000,0xdf);W(0xe82001,0x70);W(0xe82002,0x07);W(0xe82003,0xc0);
 /* Mode10 G0 image and scroll only, no TEXT/BG: protects D17SLOW path. */
 W(0xe82500,0); W(0xe82501,0xe4);W(0xe82601,1);
 W(0xc00001,1);W(0xc00401,1); W(0xe80018,0);W(0xe80019,1);
 assert(pwp_frame_render_mode10(256,256,1));
 const uint8_t *buf=(const uint8_t*)(uintptr_t)pwp_frame_pointer();
 unsigned long h=2166136261UL;
 for(uint32_t i=0;i<pwp_frame_size();i++)h=(h^buf[i])*16777619UL&0xffffffffu;
 printf("%08lx\n",h);
 return 0;
}
