import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createWasmGuestFile} from '../src/wasm-guestfs.js';

const wasmBytes=new Uint8Array(await readFile(fileURLToPath(new URL('../core/pwp_guestfs.wasm', import.meta.url))));
class FakeFileReaderSync {
  readAsArrayBuffer(slice){return slice.bytes.buffer.slice(slice.bytes.byteOffset,slice.bytes.byteOffset+slice.bytes.length);}
}
function fileOf(a) {return {size:a.length,slice(s,e){return {bytes:Uint8Array.from(a.slice(s,e))};}};}

test('full JS→WASM→sync Worker file reader round-trip',async()=>{
 const fs=await createWasmGuestFile(fileOf([16,17,18,19,20]),{FileReaderSync:FakeFileReaderSync,wasmBytes});
 assert.deepEqual([...fs.readAt(1,3)],[17,18,19]);
 assert.deepEqual([...fs.readAt(4,8)],[20]);
 assert.deepEqual([...fs.readAt(999,5)],[]);
 assert.throws(()=>fs.readAt(-1,2),RangeError);
 fs.close();
 assert.throws(()=>fs.readAt(0,1),/seek failed/);
});

test('WASM guestfs wrapper rejects reads larger than 64KiB scratch',async()=>{
 const fs=await createWasmGuestFile(fileOf([1]),{FileReaderSync:FakeFileReaderSync,wasmBytes});
 assert.throws(()=>fs.readAt(0,65537),RangeError);
 fs.close();
});
