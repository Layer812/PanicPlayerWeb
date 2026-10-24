import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mode10GraphicsSlots,mode10GraphicsLayers,mode10DisplayPage} from '../src/mode10-display.mjs';
const poke=(e,a,v)=>assert.equal(e.pwp_bus_write8(a,v),1,`write ${a.toString(16)}`);
const firstRGBA=e=>Array.from(new Uint8Array(e.memory.buffer,e.pwp_frame_pointer(),4));
const vram=(e,logicalPage,x,y,low8)=>poke(e,0xc00000+(logicalPage*0x80000)+(y*512+x)*2+1,low8);
const setPalette=(e,index,r,g,b)=>{
 const word=((Math.round(g*31/255)&31)<<11)|((Math.round(r*31/255)&31)<<6)|((Math.round(b*31/255)&31)<<1);
 poke(e,0xe82000+index*2,word>>8);poke(e,0xe82000+index*2+1,word&255);
};
const wasm=readFileSync(new URL('../core/pwp_x68k_video_frame.wasm',import.meta.url));
async function setup(){const e=(await WebAssembly.instantiate(wasm)).instance.exports;
 e.pwp_bus_reset();poke(e,0xe80028,1);poke(e,0xe82501,0xe4);
 setPalette(e,1,255,0,0);setPalette(e,2,0,255,0);setPalette(e,0x21,0,0,255);
 return e;
}
test('FIX17R2: four physical nibbles make two 256-colour groups',()=>{
 assert.deepEqual(mode10GraphicsSlots(0xe4,0x43),[{rank:0,page:0},{rank:1,page:1}]);
 assert.deepEqual(mode10GraphicsLayers(0xe4,0x4f),[
  {layer:0,enabled:true,lowPage:0,highPage:1},
  {layer:1,enabled:true,lowPage:2,highPage:3}]);
 assert.equal(mode10DisplayPage(0x41),0);assert.equal(mode10DisplayPage(0x44),1);
 assert.equal(mode10DisplayPage(0x4f),null);
 assert.throws(()=>mode10GraphicsSlots(-1,1),RangeError);
});
test('FIX17R2: both 8-bit pages, alpha index 0, and pair-on enable',async()=>{
 const e=await setup();
 vram(e,0,0,0,1);vram(e,1,0,0,2);
 poke(e,0xe82601,0x4f);assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[251,0,0,255]);
 poke(e,0xe82601,0x4c);assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,251,0,255]);
 poke(e,0xe82601,0x4e);assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[251,0,0,255]);
 vram(e,0,0,0,0);assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,251,0,255]);
});
test('FIX17R2: R1 4-bit nibble pairing changes 8-bit palette index',async()=>{
 const e=await setup();
 vram(e,0,0,0,1);vram(e,1,0,0,2); // physical nibbles: 1,0,2,0
 poke(e,0xe82601,0x4f);
 // slot 0<-physical page0; slot1<-physical page2 -> palette 0x21 blue
 poke(e,0xe82501,0xe8);
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,0,251,255]);
});
test('FIX17R2: independent scroll of selected physical pages',async()=>{
 const e=await setup();
 vram(e,1,300,280,2); // nibble 2 at physical page 2, back logical screen
 // Set physical page2 scroll x300, y280
 poke(e,0xe80020,1);poke(e,0xe80021,44);
 poke(e,0xe80022,1);poke(e,0xe80023,24);
 poke(e,0xe82601,0x4c);
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,251,0,255]);
 // Hide all, must not reuse last buffer
 poke(e,0xe82601,0x40);
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,0,0,255]);
 poke(e,0xe82600,0x18);
 assert.equal(e.pwp_frame_render_mode10(256,256,0),0);
 assert.equal(e.pwp_frame_size(),0);
});

test('FIX17R2: actual R2=0x006F exposes front and back logical 256-color screens',async()=>{
 const e=await setup();
 vram(e,1,0,0,0x21); // physical page2 nibble 1 plus page3 nibble 2 -> blue 8bit background
 poke(e,0xe82600,0);poke(e,0xe82601,0x6f);
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,0,251,255]);
 vram(e,0,0,0,1); // opaque front layer now covers both background nibbles
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[251,0,0,255]);
});

// FIX17R3: authentic IOCS gate must configure the byte/nibble priority
// register before guest PANIC.X starts filling GVRAM. FIX17R2 left R1=0
// and read the same four-bit physical page into BOTH halves of each byte.
test('FIX17R3: IOCS CRTMOD10 initializes the 256-color priority order',async()=>{
 const e=(await WebAssembly.instantiate(wasm)).instance.exports;
 e.pwp_bus_reset();
 assert.equal(e.pwp_bus_apply_crtmod10(),1);
 assert.equal(e.pwp_bus_g_clr_on10(),1);
 setPalette(e,0x21,0,0,255);
 vram(e,0,0,0,0x21);
 poke(e,0xe82601,0x0f);
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.deepEqual(firstRGBA(e),[0,0,251,255],
  'original physical [0,1] order must decode complete 8-bit palette index');
 // Guest VC register priority write must override default.
 poke(e,0xe82501,0); 
 assert.equal(e.pwp_frame_render_mode10(256,256,0),1);
 assert.notDeepEqual(firstRGBA(e),[0,0,251,255]);
});
