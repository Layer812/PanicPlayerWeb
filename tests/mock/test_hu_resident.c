#include <assert.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include "pwp_hu_resident.h"
static void w16(uint8_t *p,uint16_t n){p[0]=(uint8_t)(n>>8);p[1]=(uint8_t)n;}
static void w32(uint8_t *p,uint32_t n){w16(p,(uint16_t)(n>>16));w16(p+2,(uint16_t)n);}
static uint32_t r32(const uint8_t *p){return ((uint32_t)p[0]<<24)|((uint32_t)p[1]<<16)|((uint32_t)p[2]<<8)|p[3];}
int main(void){
 uint8_t file[120]={0},out[100],snap[100];pwp_hu_image info={0};
 file[0]='H';file[1]='U';w32(file+8,2);w32(file+12,32);w32(file+20,16);w32(file+24,10);
 w32(file+64+4,0x123);w16(file+64+12,0x456);w32(file+64+20,0x789);
 w16(file+96,4);w16(file+98,9);w16(file+100,1);w32(file+102,8);
 memset(out,0xaa,sizeof out);
 assert(pwp_hu_stage(file,106,out,sizeof out,0x2000,&info));
 assert(info.load_address==0x2000&&info.entry_address==0x2002&&info.end_address==0x2030);
 assert(info.relocation_count==3&&info.text_size==32&&info.bss_size==16);
 assert(r32(out+4)==0x2123 && out[12]==0x24&&out[13]==0x56&&r32(out+20)==0x2789);
 for(unsigned i=32;i<48;i++)assert(out[i]==0);
 memcpy(snap,out,sizeof out);
 /* Malformed fixup must refuse the write atomically. */
 w16(file+96,0x200);assert(!pwp_hu_stage(file,106,out,sizeof out,0x2000,&info));
 assert(memcmp(out,snap,sizeof out)==0);
 w16(file+96,4);w32(file+100,1);assert(!pwp_hu_stage(file,106,out,sizeof out,0x2000,&info));
 assert(memcmp(out,snap,sizeof out)==0);
 w16(file+100,1);w32(file+102,8);
 assert(!pwp_hu_stage(file,105,out,sizeof out,0x2000,&info));
 assert(!pwp_hu_stage(file,106,out,sizeof out,0xfffff0,&info));
 assert(!pwp_hu_stage(file,106,out,47,0x2000,&info));
 /* Relocations use the difference from the stored base, not the load itself. */
 w32(file+4,0x1000);
 assert(pwp_hu_stage(file,106,out,sizeof out,0x2000,&info));
 assert(r32(out+4)==0x1123);
 /* Real-resident check reads guest trap #3 vector; no stub signature created. */
 uint8_t guest[256]={0};assert(!pwp_zm2_guest_resident(guest,sizeof guest));
 w32(guest+0x8c,0xa0);memcpy(guest+0x98,"ZmuSiC",6);w16(guest+0x9e,0x2080);
 assert(pwp_zm2_guest_resident(guest,sizeof guest));
 w16(guest+0x9e,0x3010);assert(!pwp_zm2_guest_resident(guest,sizeof guest));
 w16(guest+0x9e,0x2080);w32(guest+0x8c,255);assert(!pwp_zm2_guest_resident(guest,sizeof guest));
 puts("PASS bounded real HU relocations + v2 guest trap-vector resident check");
 return 0;
}
