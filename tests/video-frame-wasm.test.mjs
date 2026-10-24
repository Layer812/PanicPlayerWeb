import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'core/pwp_x68k_video_frame.wasm');
async function load(){
  const bytes=fs.readFileSync(file);
  const mod=new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(mod),[]);
  const e=(await WebAssembly.instantiate(mod,{})).exports;
  return e;
}
function pixels(e){return new Uint8Array(e.memory.buffer,e.pwp_frame_pointer(),e.pwp_frame_size()).slice();}
function setPalette(e,idx,color,text=false){
  const addr=(text?0xe82200:0xe82000)+idx*2;
  assert.equal(e.pwp_bus_write8(addr,color>>>8),1);
  assert.equal(e.pwp_bus_write8(addr+1,color&255),1);
}
test('R8 true WASM: 16-color graphics -> RGBA and TEXT transparent overlay',async()=>{
  const e=await load(); e.pwp_bus_reset();
  setPalette(e,3,0x07c0); // red, I=0
  setPalette(e,1,0xf800,true); // green, I=0
  for(let p=0;p<4;p++)e.pwp_bus_write8(0xc00001+p*0x80000,[3,0,0,0][p]);
  assert.equal(e.pwp_bus_graphic_word(0,0),3);
  assert.equal(e.pwp_frame_render(2,2,0,0),1);
  assert.equal(e.pwp_frame_size(),16);
  let b=pixels(e);assert.deepEqual(Array.from(b.slice(0,4)),[251,0,0,255]);
  assert.deepEqual(Array.from(b.slice(4,8)),[0,0,0,255]);
  e.pwp_bus_write8(0xe00000,0x80); // x=0, y=0, text plane 0
  assert.equal(e.pwp_frame_render(2,1,0,1),1);
  b=pixels(e);assert.deepEqual(Array.from(b.slice(0,4)),[0,251,0,255]);
  assert.deepEqual(Array.from(b.slice(4,8)),[0,0,0,255]);
  assert.equal(e.pwp_frame_render(2,1,0,0),1);
  assert.deepEqual(Array.from(pixels(e).slice(0,4)),[251,0,0,255]);
});
test('R8 true WASM: 256 color page0/page1 and direct GRBi 65536',async()=>{
  const e=await load();e.pwp_bus_reset();
  e.pwp_bus_write8(0xe80028,1); // 256 colors
  e.pwp_bus_write8(0xc00001,0x35); // low byte -> page 0
  e.pwp_bus_write8(0xc80001,0xb6); // high byte -> page 1
  assert.equal(e.pwp_bus_graphic_word(0,0),0xb635);
  setPalette(e,0x35,0x003e); // blue
  setPalette(e,0xb6,0xf800); // green
  assert.equal(e.pwp_frame_render(1,1,0,0),1);
  assert.deepEqual(Array.from(pixels(e)),[0,0,251,255]);
  assert.equal(e.pwp_frame_render(1,1,1,0),1);
  assert.deepEqual(Array.from(pixels(e)),[0,251,0,255]);
  e.pwp_bus_write8(0xe80028,8); // 65536 colors
  e.pwp_bus_write8(0xc00000,0x07);
  e.pwp_bus_write8(0xc00001,0xc0);
  assert.equal(e.pwp_bus_graphic_word(0,0),0x07c0);
  assert.equal(e.pwp_frame_render(1,1,0,0),1);
  assert.deepEqual(Array.from(pixels(e)),[251,0,0,255]);
});
test('R8 true WASM: TEXT scroll, graphics scroll, 6-bit intensity',async()=>{
  const e=await load(); e.pwp_bus_reset();
  setPalette(e,3,0xf800); // green
  setPalette(e,1,0x003e,true); // blue
  e.pwp_bus_write8(0xc00003,3); // pixel x=1 page 0
  e.pwp_bus_write8(0xe80019,1); // graphic x scroll=1
  assert.equal(e.pwp_frame_render(1,1,0,0),1);
  assert.deepEqual(Array.from(pixels(e)),[0,251,0,255]);
  // text at x=1 with a 0x40 bit in plane 0; text-scroll x=1
  e.pwp_bus_write8(0xe00000,0x40);
  e.pwp_bus_write8(0xe80015,1);
  assert.equal(e.pwp_frame_render(1,1,0,1),1);
  assert.deepEqual(Array.from(pixels(e)),[0,0,251,255]);
  assert.equal(e.pwp_frame_grb8888(0xffff)>>>0,0xffffffff);
  assert.equal(e.pwp_frame_grb8888(0x0001)>>>0,0x040404ff);
});
test('R8 invalid raster modes/pages/dimensions do not expose stale framebuffer',async()=>{
  const e=await load();e.pwp_bus_reset();
  assert.equal(e.pwp_frame_render(512,512,0,0),1);
  assert.equal(e.pwp_frame_size(),512*512*4);
  assert.equal(e.pwp_frame_render(513,1,0,0),0);
  assert.equal(e.pwp_frame_size(),0);
  assert.equal(e.pwp_frame_render(0,1,0,0),0);
  e.pwp_bus_write8(0xe80028,4);
  assert.equal(e.pwp_frame_render(1,1,0,0),0); // 1024-dot mode not supported
  e.pwp_bus_write8(0xe80028,8);
  assert.equal(e.pwp_frame_render(1,1,3,0),0); // no page 3 in direct color
  e.pwp_bus_write8(0xe80028,1);
  assert.equal(e.pwp_frame_render(1,1,2,0),0); // 256 colors only 2 pages
  assert.equal(e.pwp_frame_render(1,1,0,2),0); // invalid overlay flag
});
