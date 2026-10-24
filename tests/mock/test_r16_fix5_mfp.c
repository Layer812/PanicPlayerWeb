/* Device-level regression, not a substitute for real Musashi execution. */
#include <assert.h>
#include <stdio.h>
#include <stdint.h>
#include "pwp_x68k_video_bus.h"
int main(void){
 uint8_t v=0;
 pwp_bus_reset();
 assert(pwp_bus_mfp_vdisp_enabled()==0u);
 assert(pwp_bus_access8(0xe88009u)&&pwp_bus_access8(0xe88015u));
 assert(pwp_bus_writable8(0xe88009u)&&pwp_bus_writable8(0xe88015u));
 assert(!pwp_bus_access8(0xe88007u)); /* Not a complete MC68901. */
 assert(!pwp_bus_access8(0xe88008u));
 assert(!pwp_bus_access8(0xe88017u));
 assert(pwp_bus_read8(0xe88009u,&v)&&v==0x3e);
 assert(pwp_bus_mfp_ierb_reads()==1u);
 assert(pwp_bus_mfp_imrb_reads()==0u);
 assert(pwp_bus_mfp_last_read_address()==0xe88009u);
 assert(pwp_bus_read8(0xe88015u,&v)&&v==0x3e);
 assert(pwp_bus_mfp_ierb_reads()==1u&&pwp_bus_mfp_imrb_reads()==1u);
 assert(pwp_bus_mfp_last_read_address()==0xe88015u);
 assert(pwp_bus_video_writes()==0u && pwp_bus_pixel_mutations()==0u);
 assert(pwp_bus_write8(0xe88009u,0x40u));
 assert(pwp_bus_write8(0xe88015u,0x23u));
 assert(pwp_bus_read8(0xe88009u,&v)&&v==0x40u);
 assert(pwp_bus_read8(0xe88015u,&v)&&v==0x23u);
 assert(pwp_bus_video_writes()==0u && pwp_bus_pixel_mutations()==0u);
 assert(!pwp_bus_mfp_vdisp_enabled());
 assert(pwp_bus_write8(0xe88009u,0x7eu));
 assert(pwp_bus_write8(0xe88015u,0x7eu));
 assert(pwp_bus_mfp_vdisp_enabled()==1u);
 assert(pwp_bus_write8(0xe88015u,0x3eu));
 assert(pwp_bus_mfp_vdisp_enabled()==0u);
 assert(!pwp_bus_write8(0xe88017u,0x40u));
 pwp_bus_reset();
 assert(pwp_bus_read8(0xe88009u,&v)&&v==0x3e);
 assert(pwp_bus_read8(0xe88015u,&v)&&v==0x3e);
 assert(pwp_bus_mfp_ierb_reads()==1u && pwp_bus_mfp_imrb_reads()==1u);
 puts("PASS R16 FIX5 narrow real MFP interrupt register subset");
 return 0;
}
