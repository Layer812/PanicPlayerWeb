/* Human68k .X loader: 64-byte HU header and delta-encoded relocations.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT (original glue).
 * No driver or emulated host shortcut is installed by this file.
 */
#include "pwp_hu_resident.h"
#include <string.h>
static uint16_t be16(const uint8_t *p){return (uint16_t)(((uint16_t)p[0]<<8)|p[1]);}
static uint32_t be32(const uint8_t *p){return ((uint32_t)be16(p)<<16)|be16(p+2);}
static void wr16(uint8_t *p,uint16_t v){p[0]=(uint8_t)(v>>8);p[1]=(uint8_t)v;}
static void wr32(uint8_t *p,uint32_t v){wr16(p,(uint16_t)(v>>16));wr16(p+2,(uint16_t)v);}
/* Validate relocation table twice (no transient guest RAM corruption).
 * Displacements encode low bit as width (word vs long); 0x0001 means
 * a following 32-bit extended displacement. */
static int fixups(const uint8_t *table,size_t n,uint64_t initialized,
                  uint8_t *dst,uint32_t delta,uint32_t *count){
    size_t p=0;uint64_t offset=0;uint32_t k=0;
    while(p<n){
        if(n-p<2u)return 0;
        uint32_t step=be16(table+p);p+=2;
        if(step==1u){if(n-p<4u)return 0;step=be32(table+p);p+=4;}
        uint32_t width=(step&1u)?2u:4u;
        offset+=(uint64_t)(step&~1u);
        if(offset&1u || offset>initialized || width>initialized-offset)return 0;
        if(dst){
            if(width==2u)wr16(dst+(size_t)offset,(uint16_t)(be16(dst+(size_t)offset)+(uint16_t)delta));
            else wr32(dst+(size_t)offset,be32(dst+(size_t)offset)+delta);
        }
        ++k;
    }
    if(count)*count=k;
    return 1;
}
int pwp_hu_stage(const uint8_t *file,size_t length,uint8_t *dst,
                 size_t capacity,uint32_t load_address,pwp_hu_image *info){
    if(!file||!dst||!info||length<64u||file[0]!='H'||file[1]!='U'||
       load_address>=0x1000000u || (load_address&1u))return 0;
    uint32_t base=be32(file+4),entry=be32(file+8);
    uint32_t text=be32(file+12),data=be32(file+16),bss=be32(file+20);
    uint32_t reloc=be32(file+24),syms=be32(file+28);
    uint64_t init=(uint64_t)text+data,full=init+bss;
    uint64_t file_need=64ull+init+reloc+syms;
    if(!text || entry>=init || full>capacity ||
       (uint64_t)load_address+full>0x1000000ull ||
       file_need>length || (reloc&1u))return 0;
    const uint8_t *relocations=file+64u+(size_t)init;
    uint32_t count=0;
    if(!fixups(relocations,reloc,init,NULL,0,&count))return 0;
    /* Input/output disjointness is part of the public API contract. */
    memcpy(dst,file+64u,(size_t)init);
    memset(dst+(size_t)init,0,(size_t)bss);
    const uint32_t delta=load_address-base;
    (void)fixups(relocations,reloc,init,dst,delta,NULL);
    pwp_hu_image staged={load_address,load_address+entry,(uint32_t)(load_address+full),
                         text,data,bss,count};
    *info=staged;
    return 1;
}
int pwp_zm2_guest_resident(const uint8_t *ram,size_t length){
    if(!ram||length<0x90u)return 0;
    const uint32_t handler=be32(ram+0x8cu);
    if(handler<8u || (handler&1u) || handler>=length || handler>=0x1000000u)return 0;
    if(memcmp(ram+handler-8u,"ZmuSiC",6)!=0)return 0;
    const uint16_t version=be16(ram+handler-2u);
    return version>=0x2000u && version<0x3000u;
}
