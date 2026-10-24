/* Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "pwp_x68k_video_bus.h"
#define DMA 0x00e840c0u
static void wr(uint32_t a,uint8_t v){assert(pwp_bus_write8(a,v));}
static uint8_t rd(uint32_t a){uint8_t v=0;assert(pwp_bus_read8(a,&v));return v;}
static void setup_dma(uint32_t addr, uint16_t size){
  wr(DMA+4,0x80);wr(DMA+5,0x32);wr(DMA+6,0x04);
  wr(DMA+0x0a,(uint8_t)(size>>8));wr(DMA+0x0b,(uint8_t)size);
  wr(DMA+0x0d,(uint8_t)(addr>>16));wr(DMA+0x0e,(uint8_t)(addr>>8));
  wr(DMA+0x0f,(uint8_t)addr);
  wr(DMA+0x15,0xe9);wr(DMA+0x16,0x20);wr(DMA+0x17,0x03);
}
int main(void){
 uint8_t ram[0x1000]={0};ram[0x100]=0x12;ram[0x101]=0x34;
 pwp_bus_reset();
 /* STR with no configured MTC/mode remains rejected (FIX40 protection). */
 assert(!pwp_bus_write8(DMA+7,0x80));
 assert(pwp_bus_dmac3_start_rejections()==1);
 wr(0x00e92001,2);wr(0x00e9a005,0x08);
 setup_dma(0x100,2);
 assert(!pwp_bus_write8(DMA+7,0xc0)); /* Unsupported chain */
 assert(!pwp_bus_write8(DMA+7,0x88)); /* IRQ request needs real vector */
 assert(pwp_bus_write8(DMA+7,0x80));
 assert(rd(DMA)==8u);
 assert(pwp_bus_dma3_step(1,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==1);
 assert(rd(DMA+0x0b)==1 && rd(DMA+0x0f)==0x01);
 int32_t e=pwp_bus_sound_pop();
 assert(e==0x8000); /* MSM6258 reset/play event */
 e=pwp_bus_sound_pop();
 assert((e&255)==0x12 && ((e>>10)&7)==2u);
 assert(pwp_bus_sound_pop()==-1);
 assert(pwp_bus_dma3_step(4096,ram,sizeof(ram)));
 assert(rd(DMA)==0x80u && pwp_bus_dma3_completions()==1);
 assert(rd(DMA+0x0b)==0 && rd(DMA+0x0f)==0x02);
 e=pwp_bus_sound_pop();
 assert((e&255)==0x34 && ((e>>10)&7)==2u);
 assert(pwp_bus_sound_pop()==-1 && pwp_bus_sound_bytes()==2u);
 /* Genuine HD63450 OCR=4A 6-byte array descriptors: BTC counts blocks. */
 pwp_bus_reset();wr(0xe92001u,2);wr(0xe9a005u,0x08);
 ram[0x200]=0;ram[0x201]=0;ram[0x202]=1;ram[0x203]=0;
 ram[0x204]=0;ram[0x205]=1;
 ram[0x206]=0;ram[0x207]=0;ram[0x208]=1;ram[0x209]=1;
 ram[0x20a]=0;ram[0x20b]=1;
 setup_dma(0x0,1);wr(DMA+5,0x4au);wr(DMA+0x0b,0);
 wr(DMA+0x1a,0);wr(DMA+0x1b,2);
 wr(DMA+0x1d,0);wr(DMA+0x1e,2);wr(DMA+0x1f,0);
 assert(pwp_bus_write8(DMA+7,0x80));
 assert(pwp_bus_dma3_step(1,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==1 && rd(DMA+0x1b)==1);
 assert(rd(DMA+0x0f)==0x01 && rd(DMA+0x0b)==1);
 assert(pwp_bus_dma3_step(4096,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==2 && pwp_bus_dma3_completions()==1);
 assert(rd(DMA)==0x80u && rd(DMA+0x1b)==0);
 assert(rd(DMA+0x1f)==0x0c && rd(DMA+0x0f)==0x02);
 assert(pwp_bus_sound_pop()==0x8000);
 e=pwp_bus_sound_pop();assert((e&255)==0x12);
 e=pwp_bus_sound_pop();assert((e&255)==0x34);
 assert(pwp_bus_sound_pop()==-1);
 /* FIX44: 1ms of 16MHz guest cycles at ADPCM clock index 2 is
  * 187500/12 = 15625 nibbles/s = 7812.5 DMA bytes/s.
  * Before FIX44 /48 incorrectly supplied only 3906.25 bytes/s. */
 pwp_bus_reset();wr(0xe92001u,2);wr(0xe9a005u,0x08);
 setup_dma(0x100,20);
 assert(pwp_bus_write8(DMA+7,0x80));
 assert(pwp_bus_dma3_step(1,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==1);
 assert(pwp_bus_dma3_step(16000,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==8); /* 1 initial + 7 completed in first ms */
 assert(pwp_bus_dma3_step(16000,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==16); /* +8 completed in second ms */
 assert(rd(DMA+0x0b)==4);
 assert(pwp_bus_dma3_completions()==0);
 assert(pwp_bus_dma3_step(16000,ram,sizeof(ram)));
 assert(pwp_bus_dma3_bytes_sent()==20);
 assert(pwp_bus_dma3_completions()==1 && rd(DMA)==0x80u);
 /* Never silently wrap unknown guest RAM. */
 pwp_bus_reset();wr(0xe92001u,2);setup_dma(0x1fffu,1);
 assert(pwp_bus_write8(DMA+7,0x80));
 assert(!pwp_bus_dma3_step(1,ram,sizeof(ram)));
 assert(pwp_bus_dma3_fault_address()==0x1fffu);
 /* Full reset clears DMA and audio state, not merely the byte count. */
 pwp_bus_reset();
 assert(pwp_bus_dma3_bytes_sent()==0 && pwp_bus_sound_pop()==-1);
 assert(rd(DMA)==0);
 puts("PASS FIX43: verified DMA3 RAM->MSM6258 start, cycle pace, MAR/MTC/CSR, fail closed");
 return 0;
}
