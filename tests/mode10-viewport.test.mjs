import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const bin=resolve(fileURLToPath(new URL('../core/pwp_x68k_video_frame.wasm',import.meta.url)));
const rgba=e=>new Uint8Array(e.memory.buffer,e.pwp_frame_pointer(),e.pwp_frame_size()).slice();
function poke(e,a,b){assert.equal(e.pwp_bus_write8(a,b),1,`write 0x${a.toString(16)}`);}
test('FIX14: real video WASM mode10 viewport is 256x256, with guest CRTC scroll (not a fake crop)',async()=>{
 const e=(await WebAssembly.instantiate(readFileSync(bin))).instance.exports;
 e.pwp_bus_reset();
 poke(e,0xe80028,1); // CRT mode 10's 256-color GVRAM decoder
 poke(e,0xe82006,0x07);poke(e,0xe82007,0xc0); // graphics palette[3] = red
 const off=(280*512+300)*2+1;poke(e,0xc00000+off,3);
 assert.equal(e.pwp_frame_render(256,256,0,0),1);
 assert.equal(e.pwp_frame_size(),256*256*4);
 assert.deepEqual([...rgba(e).slice(0,4)],[0,0,0,255]); // offscreen pixel must not leak
 poke(e,0xe80018,1);poke(e,0xe80019,44); // scroll_x=300
 poke(e,0xe8001a,1);poke(e,0xe8001b,24); // scroll_y=280
 assert.equal(e.pwp_frame_render(256,256,0,0),1);
 assert.deepEqual([...rgba(e).slice(0,4)],[251,0,0,255]);
 assert.equal(e.pwp_frame_render(512,512,0,0),1);
 assert.equal(e.pwp_frame_size(),512*512*4); // independent diagnostic scan size
});
