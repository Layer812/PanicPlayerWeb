/* Guest-driven scanout tests: no synthetic CPU frames, bounded bus writes. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "pwp_x68k_video_bus.h"
#include "pwp_x68k_frame.h"
#define B(a,v) assert(pwp_bus_write8((a),(v)))
#define RED 0x07c0u
#define T_PALETTE(k,word) do { B(0xe82200u+2u*(k),(word)>>8); B(0xe82201u+2u*(k),(word)&0xffu); } while(0)
static uint8_t pixel(unsigned x,unsigned y,unsigned ch){
    return ((const uint8_t*)(uintptr_t)pwp_frame_pointer())[(y*16u+x)*4u+ch];
}
static void spr(unsigned n,uint16_t x,uint16_t y,uint16_t ctrl,uint16_t pri){
    uint32_t a=0xeb0000u+n*8u;
    B(a,x>>8); B(a+1,x&255);B(a+2,y>>8);B(a+3,y&255);
    B(a+4,ctrl>>8); B(a+5,ctrl&255); B(a+6,pri>>8);B(a+7,pri&255);
}
static void draw(void){assert(pwp_frame_render_mode10(16,16,1)==1);assert(pwp_frame_size()==16*16*4);}
int main(void){
    uint8_t line[16];
    pwp_bus_reset();
    assert(pwp_bus_apply_crtmod10());
    assert(pwp_bus_g_clr_on10());
    assert(pwp_bus_sp_init10());
    /* Valid PCG and sprite attributes alone never produce an image. */
    T_PALETTE(0x11,RED);
    B(0xeb8000u,0x10u); /* pattern0 pixel (0,0)=1, rest transparent */
    spr(0,16,16,0x0100,3);
    B(0xeb0808u,2);
    draw();assert(pixel(0,0,0)==0);
    assert(pwp_bus_sp_on10());
    assert(pwp_bus_cynthia_active_sprites()==1);
    pwp_bus_cynthia_line(0,16,line);
    assert(line[0]==0x11 && line[1]==0);
    draw();assert(pixel(0,0,0)==251 && pixel(0,0,1)==0);
    assert(pixel(1,0,0)==0 && pixel(0,1,0)==0);
    /* Character movement must change pixels without any GVRAM mutation. */
    uint32_t gv_mut=pwp_bus_pixel_mutations();
    spr(0,17,16,0x0100,3);
    draw();assert(pixel(0,0,0)==0 && pixel(1,0,0)==251);
    assert(pwp_bus_pixel_mutations()==gv_mut);
    /* A hidden sprite must not paint even when PCG has nonzero colors. */
    spr(0,16,16,0x0100,0);draw();assert(pixel(0,0,0)==0);
    /* Flip and 16x16 right-segment PCG addressing. */
    B(0xeb8000u+128u+64u+3u,0x02u); /* pattern1 last pixel x=15 ->2 */
    T_PALETTE(0x12,RED);
    spr(0,16,16,0x4101,3);draw();assert(pixel(0,0,0)==251);
    /* BG0 plane is controlled by the real guest, no unconditional pattern. */
    spr(0,16,16,0,0);B(0xeb0809u,1); /* BG0 enabled, 8x8 */
    B(0xebc000u,0x02); B(0xebc001u,0x02); /* tile2 palette bank2 */
    B(0xeb8000u+64u,0x30); T_PALETTE(0x23,RED);
    draw();assert(pixel(0,0,0)==251 && pixel(1,0,0)==0);
    /* Video controller SON gate and CYNTHIA DISP gate work independently. */
    B(0xeb0808u,0);draw();assert(pixel(0,0,0)==0);
    B(0xeb0808u,2); B(0xe82601u,1);draw();assert(pixel(0,0,0)==0);
    B(0xe82601u,0x41);draw();assert(pixel(0,0,0)==251);
    puts("PASS FIX34 CYNTHIA sprite and BG guest compositing");
    return 0;
}
