/* Regression for FIX34's inaccessible CYNTHIA compositor after IOCS _SP_ON.
 * Tests the *unmodified* guest-owned PCG, attributes and palette via MMIO. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "pwp_x68k_frame.h"
#include "pwp_x68k_video_bus.h"
#define W(a,v) assert(pwp_bus_write8((a),(v)))
static uint8_t red_at(unsigned x){
    const uint8_t *p=(const uint8_t*)(uintptr_t)pwp_frame_pointer();
    return p[x*4u];
}
static void render(void){assert(pwp_frame_render_mode10(16u,16u,1u)==1);}
static void sprite_data(void){
    /* Palette bank 1, colour1; 16x16 PCG0 pixel(0,0)=1. */
    W(0xe82222u,0x07);W(0xe82223u,0xc0);
    W(0xeb8000u,0x10);
    W(0xeb0000u,0);W(0xeb0001u,16);
    W(0xeb0002u,0);W(0xeb0003u,16);
    W(0xeb0004u,1);W(0xeb0005u,0);
    W(0xeb0006u,0);W(0xeb0007u,3);
}
int main(void){
    pwp_bus_reset();
    assert(pwp_bus_apply_crtmod10());
    assert(pwp_bus_g_clr_on10());
    assert(pwp_bus_sp_init10());
    sprite_data();
    assert(pwp_bus_cynthia_disp_gate()==0);
    assert(pwp_bus_sprite_display_enabled()==0);
    assert(pwp_bus_cynthia_raw_sprite_count()==1);
    assert(pwp_bus_cynthia_active_sprites()==0);
    assert(pwp_bus_cynthia_attr_writes()==8);
    assert(pwp_bus_cynthia_pcg_writes()==1);
    assert(pwp_bus_cynthia_palette_writes()==2);
    render();assert(red_at(0)==0);
    /* This assertion specifically failed with FIX34 unless the test
     * PRE-WROTE $EB0808 high byte (incorrectly hiding the defect). */
    assert(pwp_bus_sp_on10());
    assert(pwp_bus_cynthia_disp_gate()==1);
    assert(pwp_bus_sprite_display_enabled()==1);
    assert((pwp_bus_vctrl_r2()&0x40u)!=0);
    assert(pwp_bus_cynthia_active_sprites()==1);
    render();assert(red_at(0)==251 && red_at(1)==0);
    /* IOCS _SP_OFF must preserve the actual guest sprite source. */
    assert(pwp_bus_sp_off10());
    assert(!pwp_bus_cynthia_disp_gate());
    assert(!pwp_bus_sprite_display_enabled());
    assert(pwp_bus_cynthia_raw_sprite_count()==1);
    render();assert(red_at(0)==0);
    assert(pwp_bus_sp_on10());
    render();assert(red_at(0)==251);
    /* Preserve original BG0/BG1 enable and bank selectors during _SP_ON. */
    W(0xeb0809u,0x19u);
    assert(pwp_bus_sp_off10());
    assert(pwp_bus_sp_on10());
    uint8_t hi=0,lo=0;
    assert(pwp_bus_read8(0xeb0808u,&hi));
    assert(pwp_bus_read8(0xeb0809u,&lo));
    assert(hi==0x02u && lo==0x19u);
    /* Independent gates are respected on guest direct-MMIO writes. */
    W(0xeb0808u,0u);
    render();assert(red_at(0)==0);
    W(0xeb0808u,0x02u);
    W(0xe82601u,0u);
    render();assert(red_at(0)==0);
    W(0xe82601u,0x41u);
    render();assert(red_at(0)==251);
    puts("PASS FIX35 _SP_ON DISP+SON/ OFF / restored sprite / MMIO gates");
    return 0;
}
