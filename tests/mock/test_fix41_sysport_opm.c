/* FIX41: reproduce two reported real-PAN unknown-MMIO failures. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "pwp_x68k_video_bus.h"
static uint8_t rd(uint32_t a){uint8_t v=0;assert(pwp_bus_read8(a,&v));return v;}
static void wr(uint32_t a,uint8_t v){assert(pwp_bus_write8(a,v));}
int main(void){
 pwp_bus_reset();
 /* Aniki: $E8E001 is physical system-port contrast, PX68K reset=0. */
 assert(rd(0xe8e001u)==0xf0u);
 wr(0xe8e001u,0xfcu); assert(rd(0xe8e001u)==0xfcu);
 wr(0xe8e001u,0x1fu); assert(rd(0xe8e001u)==0xffu);
 assert(pwp_bus_sysport_contrast_writes()==2);
 assert(rd(0xe8e003u)==0xf0u);
 wr(0xe8e003u,0xffu);assert(rd(0xe8e003u)==0xfbu);
 assert(rd(0xe8e007u)==0x08u); /* protect existing key port semantics */
 assert(rd(0xe8e00bu)==0xffu); /* 68000 CPU */
 assert(!pwp_bus_writable8(0xe8e00bu));
 assert(!pwp_bus_access8(0xe8e005u));
 assert(!pwp_bus_access8(0xe8e00du)); /* unmodeled SRAM gate */
 /* marianne: $E90001 is YM2151 register latch, NOT the data port. */
 assert(rd(0xe90001u)==0u);
 wr(0xe90001u,0x14u);
 assert(pwp_bus_opm_latch()==0x14u);
 assert(pwp_bus_opm_address_writes()==1);
 assert(rd(0xe90001u)==0u); /* never echo latch in PX68K */
 assert(!pwp_bus_access8(0xe90003u)); /* needs real YM2151 status */
 assert(!pwp_bus_write8(0xe90003u,0x80u));
 assert(pwp_bus_opm_data_rejections()==1u);
 assert(!pwp_bus_access8(0xe90000u));
 /* No changes to known VGA/CRTC/MMIO routes. */
 wr(0xe82500u,0x04u);assert(rd(0xe82500u)==0x04u);
 wr(0xe840c4u,0x80u);assert(rd(0xe840c4u)==0x80u);
 pwp_bus_reset();
 assert(rd(0xe8e001u)==0xf0u);
 assert(rd(0xe90001u)==0u);
 assert(pwp_bus_opm_address_writes()==0u);
 assert(pwp_bus_sysport_contrast_writes()==0u);
 puts("PASS FIX41: contrast/monitor/CPU ID and YM2151 register latch, fail-closed FM data");
 return 0;
}
