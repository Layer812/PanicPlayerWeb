import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPanicX,runStartupProbe} from '../src/hu-startup-probe.mjs';
const home=dirname(fileURLToPath(import.meta.url));
const wasm=fs.readFileSync(resolve(home,'../core/pwp_hu_boot.wasm'));
function demo(){
  const b=new Uint8Array(15412);
  const code=[0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0,0x10,0x93,0xc8,0x2f,9,0x2f,8,0xff,0x4a];
  const d=new DataView(b.buffer);b[0]=0x48;b[1]=0x55;
  d.setUint32(12,0x39a2,false);d.setUint32(16,0x252,false);d.setUint32(20,0x1772,false);
  b.set(code,64);return b;
}
test('probe positively validates pinned PANIC.X header+startup signature',()=>{
  assert.equal(verifyPanicX(demo()),true);
});
test('probe stops on mismatched code even if HU header is valid',()=>{
  const b=demo();b[72]=0;assert.throws(()=>verifyPanicX(b),/startup instruction/);
});
test('browser adapter loads HU executable, observes real first DOS trap',async()=>{
  const r=await runStartupProbe(demo(),wasm);
  assert.equal(r.success,true);assert.equal(r.instructionCount,7);
  assert.equal(r.trap,'0xFF4A');assert.equal(r.textAndDataEnd,'0x00013BF4');
});
