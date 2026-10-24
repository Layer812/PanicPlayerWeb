import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {WorkerPanFile,MAX_IO} from '../src/worker-pan-file.js';
const wasm = new Uint8Array(await readFile(fileURLToPath(new URL('../core/pwp_guestfs.wasm',import.meta.url))));

function instantiate(fileSize, reader) {
  let instance;
  const callbacks=[];
  return WebAssembly.instantiate(wasm,{pwp:{read_file(offset,ptr,n){
    callbacks.push({offset,n});
    const a=reader(offset,n);
    if (a===-1) return -1;
    const bytes=instance.exports.memory.buffer;
    if (ptr+n > bytes.byteLength) return -1;
    new Uint8Array(bytes,ptr,a.length).set(a);
    return a.length;
  }}}).then(({instance:i})=>{instance=i;assert.equal(i.exports.pwp_mount(BigInt(fileSize)),1);return {w:i.exports,callbacks};});
}

test('compiled wasm32 GuestFS: seek/read/EOF are real WASM operations',async()=>{
 const data=Uint8Array.from([10,11,12,13,14,15]);
 const {w,callbacks}=await instantiate(data.length,(off,n)=>data.slice(Number(off),Number(off)+n));
 const mem=new Uint8Array(w.memory.buffer);
 assert.equal(w.pwp_read(4096,2),2);assert.deepEqual(Array.from(mem.slice(4096,4098)),[10,11]);
 assert.equal(w.pwp_tell(),2n);
 assert.equal(w.pwp_seek(4n),1);assert.equal(w.pwp_read(4096,10),2);
 assert.deepEqual(Array.from(mem.slice(4096,4098)),[14,15]);
 assert.equal(w.pwp_read(4096,1),0);
 assert.equal(w.pwp_seek(20n),1);assert.equal(w.pwp_read(4096,3),0);
 assert.deepEqual(callbacks.map(x=>x.n),[2,2]);
 w.pwp_unmount();assert.equal(w.pwp_is_mounted(),0);
 assert.equal(w.pwp_read(4096,1),-1);
});

test('compiled wasm32 GuestFS: zero file, huge virtual file and 2MiB bound',async()=>{
 let calls=0;
 const {w}=await instantiate(4_294_967_297n,(off,n)=>{calls++;return Uint8Array.of(222).slice(0,n);});
 assert.equal(w.pwp_size(),4_294_967_297n);
 assert.equal(w.pwp_seek(4_294_967_296n),1);
 assert.equal(w.pwp_read(4096,2),1);
 assert.equal(w.pwp_tell(),4_294_967_297n);
 assert.equal(calls,1);
 assert.equal(w.pwp_read(4096,2097153),-1);
 w.pwp_unmount();assert.equal(w.pwp_mount(0n),0);
});

test('compiled wasm32 GuestFS: failed host I/O does not advance cursor',async()=>{
 const {w}=await instantiate(10,()=>-1);
 assert.equal(w.pwp_read(4096,4),-1);
 assert.equal(w.pwp_tell(),0n);
});

function readerSyncStub() {
 return {readAsArrayBuffer(blob){
   // The Blob carries its own slice; generate an independent ArrayBuffer.
   return blob.bytes.buffer.slice(blob.bytes.byteOffset,blob.bytes.byteOffset+blob.bytes.byteLength);
 }};
}
function fakeFile(data) {return {size:data.length,slice(a,b){return {bytes:Uint8Array.from(data.slice(a,b))};}};}

test('Worker FileReaderSync backing: range, EOF, and invalid range',()=>{
 const fs=new WorkerPanFile(fakeFile([4,5,6,7,8]),readerSyncStub());
 assert.deepEqual(Array.from(fs.read(1n,3)),[5,6,7]);
 assert.deepEqual(Array.from(fs.read(100n,2)),[]);
 assert.throws(()=>fs.read(-1n,3),RangeError);
 assert.throws(()=>fs.read(0n,MAX_IO+1),RangeError);
 assert.throws(()=>fs.read(BigInt(Number.MAX_SAFE_INTEGER)+1n,1),RangeError);
});
