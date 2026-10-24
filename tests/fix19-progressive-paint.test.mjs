import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusashiBridge, waitForBrowserPaint} from '../src/panic-core.mjs';

function hu() {
  // Valid HU header and entry bytes (test-only; never a replacement PANIC.X).
  const b=new Uint8Array(15412); b[0]=0x48;b[1]=0x55;
  const v=new DataView(b.buffer);
  v.setUint32(12,0x39a2,false);v.setUint32(16,0x252,false);
  v.setUint32(20,0x1772,false);
  b.set([0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0x00,0x10,0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a],64);
  return b;
}
function guestSlices(values) {
  // The fake below is permitted only in this explicit JS regression fixture.
  // Production still fails closed unless actual Tab5 Musashi WASM is loaded.
  const heap=new Uint8Array(4000000);let index=0,steps=0,write=0;
  const m={HEAPU8:heap,
    _pwp_mu_stage_ptr:()=>50000,_pwp_mu_stage_capacity:()=>65536,
    _pwp_mu_load:()=>1,
    _pwp_mu_register:i=>i===10?0x8000:0,
    _pwp_mu_guest_peek8:ptr=>{
      const command='C:\\P68K.PAN';
      if(ptr===0x8000)return command.length;
      if(ptr<=0x8000+command.length)return command.charCodeAt(ptr-0x8001);
      return 0;
    },
    _pwp_mu_set_pan_size:()=>{},
    _pwp_mu_run:()=>{
      if(index>=values.length)return 4;
      const value=values[index++];steps+=6000;
      if(value!==null){heap.set([value,0,0,255],150000);write++;}
      return index===values.length?4:1;
    },
    _pwp_mu_steps:()=>steps,
    _pwp_mu_status:()=>1,_pwp_mu_dispatch:()=>1,
    _pwp_mu_trap:()=>0xff42,_pwp_mu_trap_pc:()=>0x10000,
    _pwp_mu_io_stage_ptr:()=>20000,_pwp_mu_io_capacity:()=>65536,
    _pwp_mu_io_offset_high:()=>0,_pwp_mu_io_offset_low:()=>0,
    _pwp_mu_io_length:()=>5,_pwp_mu_supply_read:()=>1,
    _pwp_mu_iocs_crt_mode:()=>10,
    _pwp_mu_video_vctrl_r2:()=>0x6f,_pwp_mu_video_vctrl_r1:()=>0xe4,
    _pwp_mu_video_write_count:()=>write,
    _pwp_mu_video_pixel_writes:()=>write,
    _pwp_mu_video_crtc_changes:()=>0,
    _pwp_frame_render:()=>1,_pwp_frame_render_mode10:()=>1,
    _pwp_frame_pointer:()=>150000,_pwp_frame_size:()=>256*256*4
  };
  return m;
}
const after = () => new Promise(r=>setTimeout(r,1));
async function until(condition, ms=500) {
  const at=Date.now();
  while(!condition()){
    if(Date.now()-at>=ms) throw new Error('timed out waiting for real guest-slice callbacks');
    await after();
  }
}
test('FIX19 delivers three distinct guest samples in sequence before reporting end, not just the last frame',async()=>{
  const m=guestSlices([11,22,33,null]);
  const output=[];const updates=[];let ended=false;
  const host={
    videoFrame:(w,h,rgba)=>{assert.equal(w,256);assert.equal(h,256);output.push(rgba[0]);},
    displayUpdate:o=>updates.push(o.number),
    readPan:async()=>new Uint8Array(),finished:()=>{ended=true;},error:msg=>{throw new Error(msg);}
  };
  const e=createMusashiBridge(m,host,hu());
  await e.load({id:7,size:50});await e.start();
  await until(()=>ended);
  assert.deepEqual(output,[11,22,33]);
  assert.deepEqual(updates,[1,2,3]);
});
test('FIX19 does not invent new display updates for unchanged guest RGBA',async()=>{
  const m=guestSlices([44,44,44,null]);
  let count=0,ended=false;
  const host={videoFrame:()=>count++,readPan:async()=>new Uint8Array(),
    finished:()=>{ended=true;},error:msg=>{throw new Error(msg);}};
  const e=createMusashiBridge(m,host,hu());
  await e.load({id:7,size:50});await e.start();
  await until(()=>ended);
  assert.equal(count,1);
});
test('FIX19 runs next CPU task after requestAnimationFrame and subsequent event-loop task',async()=>{
  let invoked=0;
  const old=globalThis.requestAnimationFrame;
  try {
    globalThis.requestAnimationFrame=cb=>{invoked++;setTimeout(()=>cb(10),0);};
    await waitForBrowserPaint();
    assert.equal(invoked,1);
  } finally {
    if(old===undefined)delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame=old;
  }
});
