// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* FIX29: independent MSM6258 4-bit ADPCM decoder for genuine X68000
 * IOCS _ADPCMAOT DMA-array chains. No pre-rendered media and no background
 * audio worker. Source is the guest RAM snapshot at the exact IOCS call.
 * MSM6258 consumes the LOW nibble before the HIGH nibble of each byte.
 */
const STEP = [16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,
  97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,
  494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552];
const SHIFT = [-1,-1,-1,-1,2,4,6,8];
/* PX68K adpcm.c ADPCM_Clocks[] are sample-rate*12 (for the 44.1kHz
 * output scheduler). A DMA byte contains TWO 4-bit MSM6258 samples.
 * Never divide by 24 here: that is the byte clock, not the sample clock. */
const DIRECT_CLOCKS_X12 = Object.freeze([93750,125000,187500,125000,46875,62500,93750,62500]);
export function directADPCMSampleRate(rateIndex) {
  if (!Number.isInteger(rateIndex) || rateIndex < 0 || rateIndex >= DIRECT_CLOCKS_X12.length)
    throw new RangeError('Invalid 8255 + YM2151 ADPCM clock index');
  return DIRECT_CLOCKS_X12[rateIndex] / 12;
}
// 4MHz MSM6258 base, dividers 1024/768/512/384/256 (IOCS)
const RATES = [3906.25,5208.333333333333,7812.5,10416.666666666666,15625];
export function decodeNibble6258(state,n){
  n &= 15;
  const delta = Math.floor((STEP[state.index] * ((n&7)*2+1))/8);
  state.signal += n&8?-delta:delta;
  state.signal = Math.max(-2048,Math.min(2047,state.signal));
  state.index = Math.max(0,Math.min(48,state.index+SHIFT[n&7]));
  return state.signal/2048;
}
const inBounds=(p,n,size)=>Number.isSafeInteger(p)&&Number.isSafeInteger(n)&&
  p>=0&&n>=0&&p<=size&&n<=size-p;
const be16=(m,a)=>(m[a]<<8)|m[a+1];
const be32=(m,a)=>((m[a]*0x1000000)+(m[a+1]<<16)+(m[a+2]<<8)+m[a+3])>>>0;
export function decodeGuestADPCMChain(heap,ramBase,table,count,mode){
  if(!(heap instanceof Uint8Array) || !Number.isInteger(ramBase) ||
      !Number.isInteger(count)||count<1||count>256 || !Number.isInteger(mode))
    throw new TypeError('Invalid ADPCM chain parameters');
  const rateIndex=(mode>>>8)&7;
  if(rateIndex>4)throw new RangeError('Unsupported IOCS ADPCM sampling rate');
  const sourceRate=RATES[rateIndex];
  if(!inBounds(ramBase+table,count*6,heap.length) || table>0x400000-count*6)
    throw new RangeError('Invalid guest ADPCM chain table');
  const blocks=[];
  let bytes=0;
  for(let i=0;i<count;i++){
    const entry=ramBase+table+i*6;
    const offset=be32(heap,entry),size=be16(heap,entry+4);
    if(!size || offset>0x400000-size || !inBounds(ramBase+offset,size,heap.length)
       || bytes>0x40000-size)throw new RangeError('Invalid guest ADPCM block');
    blocks.push({offset:ramBase+offset,size});bytes+=size;
  }
  // Lowest IOCS rate is <8kHz, but WebAudio buffer rates cannot reliably be
  // created below 8kHz. Repeat each real decode sample at a lossless integer
  // multiple of its source rate; do not change the pitch.
  const factor=sourceRate<8000 ? (sourceRate<5000?4:2):1;
  const sampleRate=Math.round(sourceRate*factor);
  const channels=2,pan=mode&3;
  const samples=new Float32Array(bytes*2*factor*channels);
  const state={signal:0,index:0};let cursor=0;
  for(const block of blocks)for(let i=0;i<block.size;i++){
    const data=heap[block.offset+i];
    for(const nib of [data&15,(data>>4)&15]){
      const amplitude=decodeNibble6258(state,nib);
      for(let j=0;j<factor;j++){
        samples[cursor++]=(pan&1)?amplitude:0;
        samples[cursor++]=(pan&2)?amplitude:0;
      }
    }
  }
  return {samples,sampleRate,sourceRate,channels,byteCount:bytes,chainCount:count};
}
