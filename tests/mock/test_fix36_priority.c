/* Hardware-register-owned layer priority test: do not edit guest art. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "pwp_x68k_video_bus.h"
#include "pwp_x68k_frame.h"
#define W(a,v) assert(pwp_bus_write8((a),(v)))
static uint8_t pixel(unsigned channel){
    const uint8_t *ptr=(const uint8_t*)(uintptr_t)pwp_frame_pointer();
    return ptr[channel];
}
static void render(void){assert(pwp_frame_render_mode10(1,1,1)==1);}
int main(void){
  pwp_bus_reset();assert(pwp_bus_apply_crtmod10());assert(pwp_bus_g_clr_on10());
  /* First graphic nibble red; same pixel in TEXT plane0 green. */
  W(0xc00001u,1u);
  W(0xe82002u,0x07u);W(0xe82003u,0xc0u);
  W(0xe00000u,0x80u);
  W(0xe82202u,0xf8u);W(0xe82203u,0x00u);
  W(0xe82601u,0x21u); /* G0+TEXT */
  /* R1 high byte = 0x04: graphics priority0 > TEXT priority1. */
  W(0xe82500u,0x04u);
  render();assert(pixel(0)>240u && pixel(1)<10u);
  assert(pwp_frame_gfx_nonzero()==1u);
  assert(pwp_frame_text_nonzero()==1u);
  assert(pwp_frame_gfx_text_overlap()==1u);
  assert(pwp_frame_gfx_visible_pixels()==1u);
  assert(pwp_frame_text_visible_pixels()==0u);
  /* R1 high byte = 0x01: TEXT priority0 > graphics priority1. */
  W(0xe82500u,0x01u);
  render();assert(pixel(0)<10u && pixel(1)>240u);
  assert(pwp_frame_gfx_visible_pixels()==0u);
  assert(pwp_frame_text_visible_pixels()==1u);
  /* Transparent graphics index passes through to TEXT independent of priority. */
  W(0xc00001u,0u);W(0xe82500u,0x04u);
  render();assert(pixel(1)>240u);
  assert(pwp_frame_gfx_nonzero()==0u);
  /* Nonzero graphics pixel with absent graphics palette is separately observable.
     Do not fabricate a substitute colour. */
  W(0xc00001u,1u);W(0xe82002u,0u);W(0xe82003u,0u);
  render();assert(pwp_frame_gfx_palette_zero()==1u);
  assert(pixel(0)==0u && pixel(1)==0u);
  puts("PASS FIX36 VC R1 G/T priority, transparent pixel, missing G palette telemetry");
  return 0;
}
