#include <stdint.h>
#include <stdio.h>
#include <assert.h>
#include "pwp_x68k_video_bus.h"
#include "pwp_x68k_frame.h"
int main(void){
  pwp_bus_reset();
  assert(pwp_bus_write8(0xe82006,0x07));
  assert(pwp_bus_write8(0xe82007,0xc0));
  assert(pwp_bus_write8(0xc00001,3));
  assert(pwp_frame_render(2,1,0,0));
  const uint8_t *b=(const uint8_t*)pwp_frame_pointer();
  assert(pwp_frame_size()==8);
  assert(b[0]==251 && b[1]==0 && b[2]==0 && b[3]==255);
  assert(b[4]==0 && b[5]==0 && b[6]==0 && b[7]==255);
  pwp_bus_reset();
  assert(pwp_bus_write8(0xe80028,8));
  assert(pwp_bus_write8(0xc00000,0xff));
  assert(pwp_bus_write8(0xc00001,0xff));
  assert(pwp_frame_render(1,1,0,0));
  b=(const uint8_t*)pwp_frame_pointer();
  assert(b[0]==255 && b[1]==255 && b[2]==255 && b[3]==255);
  assert(!pwp_frame_render(513,1,0,0));
  assert(pwp_frame_size()==0);
  puts("PASS R8 real C frame renderer");return 0;
}
