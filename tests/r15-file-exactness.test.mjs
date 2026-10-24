import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkerPanFile} from '../src/worker-pan-file.js';
import {createMusashiBridge} from '../src/panic-core.mjs';

const command = 'C:\\P68K.PAN';
function hu() {
  const b = new Uint8Array(15412);
  b[0] = 72; b[1] = 85;
  const d = new DataView(b.buffer);
  d.setUint32(12, 0x39a2);
  d.setUint32(16, 0x252);
  d.setUint32(20, 0x1772);
  b.set([0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0,0x10,0x93,0xc8,0x2f,9,0x2f,8,0xff,0x4a],64);
  return b;
}
function harness({offset=50,length=16,size=100,read,seq=[3,4]}={}){
 let idx=0, supplied=[];const errors=[], finished=[];
 const m={ HEAPU8:new Uint8Array(2_000_000),
 _pwp_mu_stage_ptr:()=>1000,_pwp_mu_stage_capacity:()=>15412,
 _pwp_mu_load:()=>1,_pwp_mu_register:(i)=>i===10?0x8000:0,
 _pwp_mu_guest_peek8:(a)=>a===0x8000?command.length:
    a>=0x8001&&a<0x8001+command.length?command.charCodeAt(a-0x8001):0,
 _pwp_mu_set_pan_size:()=>{},_pwp_mu_run:()=>seq[Math.min(idx++,seq.length-1)],
 _pwp_mu_status:()=>1,_pwp_mu_dispatch:()=>1,_pwp_mu_trap:()=>0,
 _pwp_mu_trap_pc:()=>0,_pwp_mu_io_stage_ptr:()=>20_000,
 _pwp_mu_io_capacity:()=>65_536,_pwp_mu_io_offset_high:()=>0,
 _pwp_mu_io_offset_low:()=>offset,_pwp_mu_io_length:()=>length,
 _pwp_mu_supply_read:(n)=>{supplied.push(n);return 1;},
 _pwp_mu_iocs_crt_mode:()=>10,_pwp_mu_video_vctrl_r2:()=>0x41,_pwp_mu_video_vctrl_r1:()=>0xe4,_pwp_mu_video_write_count:()=>0,_pwp_mu_video_pixel_writes:()=>0,_pwp_mu_video_crtc_changes:()=>0,_pwp_frame_render:()=>0,
 _pwp_frame_render_mode10:()=>0,_pwp_frame_pointer:()=>0,_pwp_frame_size:()=>0};
 const host={readPan:read|| (async(_,o,l)=>new Uint8Array(Math.min(l,Math.max(0,size-o)))),
   videoFrame:()=>{},audioFrames:()=>{},finished:()=>finished.push(true),error:(e)=>errors.push(e)};
 return {m,host,errors,finished,supplied,size};
}
const flush=()=>new Promise(r=>setTimeout(r,30));

test('R15 Human68k A2 tail excludes separating blank, includes only virtual PAN argument',async()=>{
 const h=harness();const engine=createMusashiBridge(h.m,h.host,hu());
 await engine.load({id:1,size:h.size});
 assert.equal(command,'C:\\P68K.PAN');
 assert.equal(command.length,11);
});
test('R15 refuse short non-EOF Worker response, rather than silently returning false EOF',async()=>{
 const h=harness({read:async()=>new Uint8Array(3)});
 const engine=createMusashiBridge(h.m,h.host,hu());
 await engine.load({id:1,size:h.size});await engine.start();await flush();
 assert.equal(h.supplied.length,0);
 assert.match(h.errors[0],/PAN read length mismatch/);
 assert.equal(h.finished.length,0);
});
test('R15 accept true EOF as exactly zero bytes',async()=>{
 const h=harness({offset:100,read:async()=>new Uint8Array(0)});
 const engine=createMusashiBridge(h.m,h.host,hu());
 await engine.load({id:1,size:h.size});await engine.start();await flush();
 assert.deepEqual(h.supplied,[0]);assert.deepEqual(h.errors,[]);
 assert.equal(h.finished.length,1);
});
test('R15 reject length that exceeds remaining bytes, even within 64 KiB request',async()=>{
 const h=harness({offset:95,length:16,read:async()=>new Uint8Array(16)});
 const e=createMusashiBridge(h.m,h.host,hu());
 await e.load({id:1,size:100});await e.start();await flush();
 assert.match(h.errors[0],/expected 5, got 16/);
 assert.deepEqual(h.supplied,[]);
});
test('R15 refuse truncated FileReaderSync inside file slice',()=>{
 const fake={size:40,slice:(a,b)=>({start:a,end:b})};
 const file=new WorkerPanFile(fake,{readAsArrayBuffer:()=>new ArrayBuffer(1)});
 assert.throws(()=>file.read(0,10),/short\/inconsistent read/);
});
test('R15 allow a precise FileReaderSync range and real EOF',()=>{
 const fake={size:40,slice:(a,b)=>({start:a,end:b})};
 const file=new WorkerPanFile(fake,{readAsArrayBuffer:({start,end})=>new Uint8Array(end-start).buffer});
 assert.equal(file.read(37,10).byteLength,3);
 assert.equal(file.read(40,10).byteLength,0);
 assert.equal(file.read(0,0).byteLength,0);
});
