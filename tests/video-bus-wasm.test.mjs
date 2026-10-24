import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'core/pwp_x68k_video_bus.wasm');
async function module(){
  let result=await WebAssembly.instantiate(fs.readFileSync(file),{});
  return result.instance.exports;
}
test('R7 compiled video bus WASM has no external imports and stores real four-plane indices',async()=>{
  const data=fs.readFileSync(file);
  const abi=WebAssembly.Module.imports(new WebAssembly.Module(data));
  assert.deepEqual(abi,[]);
  const e=await module();e.pwp_bus_reset();
  for(let p=0;p<4;p++) assert.equal(e.pwp_bus_write8(0xe00000+p*0x20000,128),1);
  assert.equal(e.pwp_bus_text_index(0,0),15);
  assert.equal(e.pwp_bus_text_index(1,0),0);
  assert.equal(e.pwp_bus_write8(0xe8002a,1),1);
  assert.equal(e.pwp_bus_write8(0xe8002b,0x50),1);
  assert.equal(e.pwp_bus_write8(0xe00000,0x40),1);
  assert.equal(e.pwp_bus_text_index(1,0),5);
  assert.equal(e.pwp_bus_write8(0xc00001,3),1);
  assert.equal(e.pwp_bus_write8(0xc80001,10),1);
  assert.equal(e.pwp_bus_write8(0xd00001,6),1);
  assert.equal(e.pwp_bus_write8(0xd80001,12),1);
  assert.equal(e.pwp_bus_graphic_word(0,0),0xc6a3);
  assert.equal(e.pwp_bus_write8(0xe82202,0x3c),1);
  assert.equal(e.pwp_bus_write8(0xe82203,0xf0),1);
  assert.equal(e.pwp_bus_palette_word(1,1),0x3cf0);
  assert.equal(e.pwp_bus_write8(0xe90000,4),0);
  e.pwp_bus_reset();
  assert.equal(e.pwp_bus_text_index(1,0),0);
  assert.equal(e.pwp_bus_palette_word(1,1),0);
});
