/* R3 HU/startup bridge tests. Synthetic body, exact public PANIC.X startup bytes.
 * We intentionally do NOT bundle an original PANIC.X executable or claim playback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
const home = dirname(fileURLToPath(import.meta.url));
const bytes = fs.readFileSync(resolve(home,'../core/pwp_hu_boot.wasm'));
const CODE = Uint8Array.from([
  0x4d,0xfa,0x3b,0xf2, 0x4f,0xfa,0x53,0x60,
  0x41,0xe8,0x00,0x10, 0x93,0xc8, 0x2f,0x09,0x2f,0x08,
  0xff,0x4a, 0x50,0x8f, 0x2d,0x4a,0x00,0x02,
  0x2f,0x3c,0x00,0x04,0x00,0x00, 0xff,0x48,
]);
function makeHU(){
  const b=new Uint8Array(15412);
  b[0]=72;b[1]=85;
  const view=new DataView(b.buffer);
  view.setUint32(12,0x39a2,false);
  view.setUint32(16,0x252,false);
  view.setUint32(20,0x1772,false);
  b.set(CODE,64);
  return b;
}
async function core(){
  const inst = await WebAssembly.instantiate(bytes,{});
  const e=inst.instance.exports;
  const mem=new Uint8Array(e.memory.buffer);
  return {e,mem,load:(b)=>{mem.set(b,e.pwp_hu_stage_ptr()); return e.pwp_hu_load(b.length);}};
}
test('PANIC.X HU header + text/data/BSS are mapped to 68000 memory',async()=>{
  const c=await core();
  assert.equal(c.load(makeHU()),1);
  assert.equal(c.e.pwp_hu_image_end(),0x13bf4);
  assert.equal(c.e.pwp_hu_bss_end(),0x15366);
  assert.equal(c.e.pwp_hu_pc(),0x10000);
  assert.equal(c.e.pwp_hu_guest_peek32(0x10000),0x4dfa3bf2);
});
test('real PANIC.X startup reaches its FIRST real DOS F-line call (not dispatched)',async()=>{
  const c=await core();
  c.load(makeHU());
  assert.equal(c.e.pwp_hu_run(7),2);
  assert.equal(c.e.pwp_hu_steps(),7);
  assert.equal(c.e.pwp_hu_trap_opcode(),0xff4a);
  assert.equal(c.e.pwp_hu_fault_pc(),0x10012);
  assert.equal(c.e.pwp_hu_register(14),0x13bf4); // A6 = end initialized segment
  assert.equal(c.e.pwp_hu_register(15),0x1535e); // A7 = end BSS, minus 2 pushes
  assert.equal(c.e.pwp_hu_register(8),0x20010); // A0 := A0+16
  assert.equal(c.e.pwp_hu_register(9),0xff0);   // A1 := A1-A0
  assert.equal(c.e.pwp_hu_guest_peek32(0x1535e),0x20010);
  assert.equal(c.e.pwp_hu_guest_peek32(0x15362),0x00000ff0);
});
test('HU rejects altered signature',async()=>{
  const c=await core();const b=makeHU();b[0]=0;
  assert.equal(c.load(b),-2);
});
test('HU rejects truncated text/data, leaves engine unready',async()=>{
  const c=await core();const b=makeHU().subarray(0,150);
  assert.equal(c.load(b),-3);
  assert.equal(c.e.pwp_hu_status()|0,-3);
});
test('HU rejects relocated files until relocations are implemented',async()=>{
  const c=await core();const b=makeHU();new DataView(b.buffer).setUint32(24,2,false);
  assert.equal(c.load(b),-3); // missing 2 relocation bytes
  const b2=new Uint8Array(15414);b2.set(b);
  assert.equal(c.load(b2),-4);
});
test('HU rejects invalid entry, BSS outside memory, and oversized input',async()=>{
  const c=await core();
  for(const [offset,value] of [[8,0x4000],[20,0x600000]]){
    const b=makeHU();new DataView(b.buffer).setUint32(offset,value,false);
    assert.equal(c.load(b),-3);
  }
  assert.equal(c.e.pwp_hu_load(1024*1024+1),-1);
});
test('execution stays paused at trap, no fabricated DOS implementation',async()=>{
  const c=await core();c.load(makeHU());c.e.pwp_hu_run(100000);
  assert.equal(c.e.pwp_hu_run(4),2);
  assert.equal(c.e.pwp_hu_steps(),7);
});
test('invalid opcode stops with fault state, never returns a fake successful frame',async()=>{
  const c=await core();const b=makeHU();b[64]=0x4e;b[65]=0x71;
  c.load(b);assert.equal(c.e.pwp_hu_step(),-5);
  assert.equal(c.e.pwp_hu_fault_opcode(),0x4e71);
});
