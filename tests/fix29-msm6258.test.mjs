import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeNibble6258,decodeGuestADPCMChain} from '../src/adpcm-msm6258.mjs';
function makeFixture({mode=0x403,size=3,source=[0x01,0x78,0x9f]}={}){
  const heap=new Uint8Array(0x10000),base=0x4000,table=0x100,data=0x200;
  heap.set([0,0,2,0,0,size],base+table);
  heap.set(source,base+data);
  return {heap,base,table,mode};
}
test('MSM6258: index/gain update and 12bit clipping',()=>{
 const s={signal:0,index:0};
 assert.equal(decodeNibble6258(s,0),2/2048);
 assert.equal(s.index,0);
 assert.equal(decodeNibble6258(s,7),32/2048);
 assert.equal(s.index,8);
 for(let i=0;i<200;i++)decodeNibble6258(s,7);
 assert.equal(s.signal,2047);assert.equal(s.index,48);
 for(let i=0;i<300;i++)decodeNibble6258(s,0xf);
 assert.equal(s.signal,-2048);
});
test('MSM6258: low nibble first, 4MHz/256=15625Hz stereo',()=>{
 const {heap,base,table,mode}=makeFixture();
 const out=decodeGuestADPCMChain(heap,base,table,1,mode);
 assert.equal(out.sourceRate,15625);assert.equal(out.sampleRate,15625);
 assert.equal(out.byteCount,3);assert.equal(out.channels,2);
 assert.equal(out.samples.length,12);
 // first byte 0x01 => low 1 (+6), high 0 (+2): first stereo sample +6.
 assert.equal(out.samples[0],6/2048);assert.equal(out.samples[1],6/2048);
 assert.equal(out.samples[2],8/2048);
});
test('MSM6258: output mode routes mono samples exclusively to left',()=>{
 const f=makeFixture({mode:0x401});
 const out=decodeGuestADPCMChain(f.heap,f.base,f.table,1,f.mode);
 assert.ok(out.samples[0]!==0);assert.equal(out.samples[1],0);
});
test('MSM6258: 3906.25Hz is upsampled 4x without pitch change',()=>{
 const f=makeFixture({mode:0x003});
 const out=decodeGuestADPCMChain(f.heap,f.base,f.table,1,f.mode);
 assert.equal(out.sourceRate,3906.25);assert.equal(out.sampleRate,15625);
 assert.deepEqual(Array.from(out.samples.slice(0,8)),Array(4).fill(6/2048).flatMap(v=>[v,v]));
});
test('ADPCMAOT: validates guest range and rejects overrun',()=>{
 const f=makeFixture();
 f.heap[f.base+f.table+4]=0xff;f.heap[f.base+f.table+5]=0xff;
 assert.throws(()=>decodeGuestADPCMChain(f.heap,f.base,f.table,1,f.mode),/Invalid guest ADPCM block/);
});
test('ADPCMAOT: validates rate and descriptor count',()=>{
 const f=makeFixture();
 assert.throws(()=>decodeGuestADPCMChain(f.heap,f.base,f.table,257,f.mode),/parameters/);
 assert.throws(()=>decodeGuestADPCMChain(f.heap,f.base,f.table,1,0x703),/rate/);
});
