import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPanBlob,servicePanRead} from '../src/musashi-dos-io.mjs';
function mock({position=20,len=24,capacity=65536,blobSize=128}={}) {
 const mem=new Uint8Array(1024);
 const m={HEAPU8:mem,state:1,size:0,
 _pwp_mu_status(){return this.state;},
 _pwp_mu_set_pan_size(h,l){this.size=h*4294967296+l;},
 _pwp_mu_io_offset_high(){return Math.floor(position/4294967296);},
 _pwp_mu_io_offset_low(){return position>>>0;},
 _pwp_mu_io_length(){return len;},
 _pwp_mu_io_capacity(){return capacity;},
 _pwp_mu_io_stage_ptr(){return 120;},
 _pwp_mu_supply_read(n){this.delivered=n;this.state=1;return 1;}};
 const data=new Uint8Array(blobSize).map((_,i)=>i%256);
 return {m,blob:new Blob([data])};
}
test('mounts only after HU load',()=>{
 const {m,blob}=mock();mountPanBlob(m,blob);assert.equal(m.size,128);
 m.state=0;assert.throws(()=>mountPanBlob(m,blob),/loaded/);
});
test('handles exact file subrange, no eager full file copy',async()=>{
 const {m,blob}=mock();m.state=3;
 const result=await servicePanRead(m,blob);
 assert.deepEqual(result,{state:1,read:24,offset:20});
 assert.deepEqual([...m.HEAPU8.slice(120,144)],Array.from({length:24},(_,i)=>i+20));
});
test('does not service when no guest request pending',async()=>{
 const {m,blob}=mock();await assert.rejects(servicePanRead(m,blob),/No pending/);
});
test('blocks out-of-bounds and oversized requests',async()=>{
 let {m,blob}=mock({position:100,len:50});m.state=3;
 await assert.rejects(servicePanRead(m,blob),/Invalid/);
 ({m,blob}=mock({len:65537,blobSize:70000}));m.state=3;
 await assert.rejects(servicePanRead(m,blob),/Invalid/);
});
test('blocks invalid Blob input',()=>{
 const {m}=mock();assert.throws(()=>mountPanBlob(m,{size:NaN,slice(){}}),/Expected Blob/);
});
test('split calls can produce state 3 until last chunk',async()=>{
 const {m,blob}=mock({len:25});m.state=3;
 let used=0;m._pwp_mu_supply_read=n=>{used+=n;return used===25?(m.state=1):3;};
 const r=await servicePanRead(m,blob);assert.equal(r.state,1);assert.equal(used,25);
});
