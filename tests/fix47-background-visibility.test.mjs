import test from 'node:test';
import assert from 'node:assert/strict';
import {createForegroundVisibilityGate} from '../src/foreground-visibility.mjs';
import {makeGuestClockLimiter} from '../src/guest-clock.mjs';
import {createMusashiBridge} from '../src/panic-core.mjs';

class FakeDocument {
  constructor(hidden=false){this.hidden=hidden;this.listeners=new Set();}
  get visibilityState(){return this.hidden?'hidden':'visible';}
  addEventListener(type,fn){if(type==='visibilitychange')this.listeners.add(fn);}
  removeEventListener(type,fn){if(type==='visibilitychange')this.listeners.delete(fn);}
  setHidden(v){this.hidden=v;for(const fn of [...this.listeners])fn();}
}

test('FIX47: foreground gate waits for visibility and cancels on STOP',async()=>{
  const doc=new FakeDocument(true);let resumes=0;
  const gate=createForegroundVisibilityGate({doc,onResume:()=>resumes++});
  gate.start();
  let woken=false;
  const waiting=gate.waitUntilVisible().then(()=>woken=true);
  await Promise.resolve();
  assert.equal(woken,false);
  assert.equal(doc.listeners.size,1);
  doc.setHidden(false);
  await waiting;
  assert.equal(woken,true);assert.equal(resumes,1);
  doc.setHidden(true);
  const blocked=gate.waitUntilVisible();
  gate.stop();await blocked;
  assert.equal(doc.listeners.size,0);
  assert.equal(resumes,1);
});

test('FIX47: tab restoration drops hidden wall-time debt without advancing guest cycles',async()=>{
  let now=0,resumes=0;
  const doc=new FakeDocument();
  const pacer=makeGuestClockLimiter({now:()=>now,sleep:async ms=>{now+=ms;},cpuHz:16_000_000});
  const gate=createForegroundVisibilityGate({doc,onResume:()=>{pacer.resume();resumes++;}});
  pacer.reset(0);gate.start();
  await pacer.pace(160_000);
  assert.ok(Math.abs(pacer.stats().virtualMs-10)<1e-6);
  doc.setHidden(true);
  const blocked=gate.waitUntilVisible();
  now+=120000; // 2 minutes tab hidden; no guest instructions advanced.
  doc.setHidden(false);
  await blocked;
  assert.equal(resumes,1);
  assert.ok(Math.abs(pacer.lateMs())<1e-6);
  await pacer.pace(320_000);
  assert.ok(pacer.stats().virtualMs===20);
  assert.ok(Math.abs(pacer.lateMs())<7);
  assert.equal(pacer.stats().cycles,320_000);
  gate.stop();
});

function fixtureHu(){
  const b=new Uint8Array(15412);b[0]=0x48;b[1]=0x55;
  const d=new DataView(b.buffer);
  d.setUint32(12,0x39a2,false);d.setUint32(16,0x252,false);d.setUint32(20,0x1772,false);
  b.set([0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0x00,0x10,0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a],64);
  return b;
}
const COMMAND='C:\\P68K.PAN';
function fakeCpu(){
  const heap=new Uint8Array(4_000_000);
  let runs=0,cycles=0;
  const f={
    HEAPU8:heap,
    _pwp_mu_stage_ptr:()=>50000,_pwp_mu_stage_capacity:()=>65536,_pwp_mu_load:()=>1,
    _pwp_mu_register:i=>i===10?0x8000:0,
    _pwp_mu_guest_peek8:a=>a===0x8000?COMMAND.length:a>0x8000&&a<=0x8000+COMMAND.length?COMMAND.charCodeAt(a-0x8001):0,
    _pwp_mu_set_pan_size:()=>{},_pwp_mu_status:()=>1,
    _pwp_mu_audio_serial:()=>0,_pwp_mu_audio_kind:()=>0,
    _pwp_mu_io_stage_ptr:()=>210000,_pwp_mu_io_capacity:()=>65536,
    _pwp_mu_io_offset_high:()=>0,_pwp_mu_io_offset_low:()=>0,_pwp_mu_io_length:()=>0,
    _pwp_mu_supply_read:()=>1,
    _pwp_mu_run:()=>{runs++;cycles+=16000;return runs>=4?4:1;},
    _pwp_mu_guest_cycles:()=>cycles,_pwp_mu_steps:()=>runs,
    _pwp_mu_dispatch:()=>1,_pwp_mu_trap:()=>0xff42,_pwp_mu_trap_pc:()=>0x10000,
    _pwp_mu_iocs_crt_mode:()=>10,
    _pwp_mu_video_vctrl_r1:()=>0xe4,_pwp_mu_video_vctrl_r2:()=>0x2f,
    _pwp_mu_video_write_count:()=>0,_pwp_mu_video_pixel_writes:()=>0,
    _pwp_mu_video_crtc_changes:()=>0,
    _pwp_frame_render_mode10:()=>1,_pwp_frame_render:()=>1,
    _pwp_frame_pointer:()=>150000,_pwp_frame_size:()=>256*256*4,
  };
  return {m:f,runs:()=>runs};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f){const deadline=Date.now()+2000;while(!f()){if(Date.now()>deadline)throw new Error('visibility fixture timed out');await sleep(5);}}

test('FIX47: hidden tab executes NO guest CPU slices; show resumes, no replay flood',async()=>{
  const doc=new FakeDocument(true),cpu=fakeCpu();
  let finished=false,error=null;
  const host={videoFrame:()=>{},readPan:async()=>new Uint8Array(),finished:()=>finished=true,error:e=>error=e};
  const engine=createMusashiBridge(cpu.m,host,fixtureHu(),{visibilityDocument:doc});
  await engine.load({id:1,size:1024});await engine.start();
  await sleep(35);
  assert.equal(cpu.runs(),0,'CPU must not run while hidden');
  doc.setHidden(false);
  await until(()=>finished||error!==null);
  assert.equal(error,null);
  assert.equal(cpu.runs(),4);
  assert.equal(doc.listeners.size,0);
});

test('FIX47: stopping in hidden tab cancels pending foreground wait',async()=>{
  const doc=new FakeDocument(true),cpu=fakeCpu();
  const engine=createMusashiBridge(cpu.m,{readPan:async()=>new Uint8Array()},fixtureHu(),{visibilityDocument:doc});
  await engine.load({id:1,size:1024});await engine.start();
  await sleep(25);await engine.stop();
  assert.equal(cpu.runs(),0);
  assert.equal(doc.listeners.size,0);
});
