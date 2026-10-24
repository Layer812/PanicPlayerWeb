import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusashiBridge} from '../src/panic-core.mjs';

function fixtureHu(){
 const b=new Uint8Array(15412);b[0]=0x48;b[1]=0x55;
 const d=new DataView(b.buffer);d.setUint32(12,0x39a2,false);
 d.setUint32(16,0x252,false);d.setUint32(20,0x1772,false);
 b.set([0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0x00,0x10,0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a],64);
 return b;
}
const command='C:\\P68K.PAN';
function fauxClockCore(slices){
 const heap=new Uint8Array(4000000);let slice=0,writes=0,tick=0,scan=0,steps=0,cycles=0;
 return {HEAPU8:heap,
  _pwp_mu_stage_ptr:()=>50000,_pwp_mu_stage_capacity:()=>65536,
  _pwp_mu_load:()=>1,
  _pwp_mu_register:i=>i===10?0x8000:0,
  _pwp_mu_guest_peek8:a=>a===0x8000?command.length:a>0x8000&&a<=0x8000+command.length?command.charCodeAt(a-0x8001):0,
  _pwp_mu_set_pan_size:()=>{},_pwp_mu_status:()=>1,
  // FIX29 fixture is a non-audio CPU; this test asserts raster semantics only.
  _pwp_mu_audio_serial:()=>0,_pwp_mu_audio_kind:()=>0,
  _pwp_mu_audio_chain_addr:()=>0,_pwp_mu_audio_chain_count:()=>0,
  _pwp_mu_audio_mode:()=>0,_pwp_mu_audio_ram_ptr:()=>0,
  _pwp_mu_io_stage_ptr:()=>210000,_pwp_mu_io_capacity:()=>65536,
  _pwp_mu_io_offset_high:()=>0,_pwp_mu_io_offset_low:()=>0,
  _pwp_mu_io_length:()=>0,_pwp_mu_supply_read:()=>1,
  _pwp_mu_run:()=>{
   const v=slices[slice++]; if(!v)return 4;
   steps+=6000;cycles+=30000;tick=v.tick;scan=v.scan;heap.set([v.color,0,0,255],150000);writes++;
   return 1;
  },
  _pwp_mu_vdisp_ticks:()=>tick,_pwp_mu_scanout_ticks:()=>scan,_pwp_mu_guest_cycles:()=>cycles,_pwp_mu_steps:()=>steps,
  _pwp_mu_dispatch:()=>1,_pwp_mu_trap:()=>0xff42,_pwp_mu_trap_pc:()=>0x10000,
  _pwp_mu_iocs_crt_mode:()=>10,
  _pwp_mu_video_vctrl_r2:()=>0x6f,_pwp_mu_video_vctrl_r1:()=>0xe4,
  _pwp_mu_video_write_count:()=>writes,_pwp_mu_video_pixel_writes:()=>writes,
  _pwp_mu_video_crtc_changes:()=>0,
  _pwp_frame_render_mode10:()=>1,_pwp_frame_render:()=>1,
  _pwp_frame_pointer:()=>150000,_pwp_frame_size:()=>256*256*4
 };
}
async function until(pred){const deadline=Date.now()+1000;while(!pred()){if(Date.now()>deadline)throw new Error('fixture did not finish');await new Promise(r=>setTimeout(r,5));}}
test('FIX23: scanout starts only AFTER VBlank; do not show pre-ISR graphics',async()=>{
 const m=fauxClockCore([
  {tick:0,scan:0,color:10}, // change while visible, not a new scanout
  {tick:1,scan:0,color:20}, // VBlank falling edge; ISR not finished
  {tick:1,scan:0,color:30}, // VBlank ISR changes a page while blanking
  {tick:1,scan:1,color:40}, // new visible scanout sees committed ISR page
  {tick:2,scan:1,color:50}, // next VBlank; do not capture unfinished state
  {tick:2,scan:2,color:60}, // next scanout after IRQ handler
 ]);
 const shown=[],updates=[];let finished=false;let error=null;
 const h={videoFrame:(w,ht,rgba)=>shown.push(rgba[0]),readPan:async()=>new Uint8Array(),
 displayUpdate:x=>updates.push(x),finished:()=>finished=true,error:e=>error=e};
 const engine=createMusashiBridge(m,h,fixtureHu());
 await engine.load({id:5,size:100});await engine.start();await until(()=>finished||error);
 assert.equal(error,null);assert.deepEqual(shown,[40,60]);
 assert.deepEqual(updates.map(v=>v.guestVblank),[1,2]);
 assert.deepEqual(updates.map(v=>v.guestScanout),[1,2]);
 assert.ok(updates.every(v=>typeof v.signature==='string' && v.signature.length===8));
});
