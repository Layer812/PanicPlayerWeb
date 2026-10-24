#!/usr/bin/env node
/* REAL Musashi/WASM + genuine original PANIC.X acceptance. Not a frame test.
 * Verifies that IOCS $70 _MS_INIT occurs at its actual guest PC, that the
 * mouse subsystem is initialized, and that the guest instruction advances.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath, exePath]=process.argv.slice(2);
if(!modulePath||!exePath)throw new Error('Usage: RUN_R16_FIX7_MSINIT_CPU.mjs pwp_musashi.mjs PANIC.X');
const exe=readFileSync(resolve(exePath));
if(createHash('sha256').update(exe).digest('hex')!==
 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd')
 throw new Error('PANIC.X V1.38 SHA256 mismatch');
const {default:factory}=await import(pathToFileURL(resolve(modulePath)).href);
const m=await factory();
const required=['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load',
 '_pwp_mu_run','_pwp_mu_dispatch','_pwp_mu_pc','_pwp_mu_steps','_pwp_mu_trap',
 '_pwp_mu_trap_pc','_pwp_mu_register','_pwp_mu_iocs_tgusemd_calls',
 '_pwp_mu_iocs_graphics_use','_pwp_mu_iocs_text_use',
 '_pwp_mu_iocs_ms_init_calls','_pwp_mu_mouse_initialized',
 '_pwp_mu_mouse_cursor_visible','_pwp_mu_video_pixel_writes'];
for(const key of required)if(typeof m[key]!=='function')throw new Error('Actual CPU WASM export missing: '+key);
if(!(m.HEAPU8 instanceof Uint8Array))throw new Error('WASM heap unavailable');
const ptr=m._pwp_mu_stage_ptr()>>>0;
if(exe.length>m._pwp_mu_stage_capacity() || ptr>m.HEAPU8.length-exe.length)
 throw new Error('PANIC.X stage bounds invalid');
m.HEAPU8.set(exe,ptr);
if(m._pwp_mu_load(exe.length)!==1)throw new Error('Authentic PANIC.X load failed');
let seen=false, reached=false, iocsQueries=0, totalCalls=0, lastStatus=1;
for(let i=0;i<12000;i++){
 const pc=m._pwp_mu_pc()>>>0;
 if(seen&&pc===0x10092){reached=true;break;}
 let state=m._pwp_mu_run(1);
 if(state===2){
  const op=m._pwp_mu_trap()>>>0, at=m._pwp_mu_trap_pc()>>>0;
  if(op===0x4e4f){
   const functionNumber=m._pwp_mu_register(0)&255;
   if(functionNumber===0x70){
    if(seen||at!==0x10090)throw new Error(`Unexpected _MS_INIT at PC ${at.toString(16)}`);
    if(m._pwp_mu_iocs_ms_init_calls()!==0)throw new Error('_MS_INIT happened prematurely');
    if(m._pwp_mu_iocs_tgusemd_calls()!==3 ||
       m._pwp_mu_iocs_graphics_use()!==3 || m._pwp_mu_iocs_text_use()!==2)
      throw new Error('Preceding _TGUSEMD screen initialization missing');
    seen=true;
   }else if(functionNumber===0x0e){iocsQueries++;}
   else throw new Error(`Unexpected IOCS $${functionNumber.toString(16)} before _MS_INIT`);
  }else if(![0xff4a,0xff48,0xff20,0xff25].includes(op)){
    throw new Error(`Unexpected DOS $${op.toString(16)} before _MS_INIT`);
  }
  totalCalls++;
  state=m._pwp_mu_dispatch();
  if(seen && at===0x10090){
   if(state!==1 || m._pwp_mu_iocs_ms_init_calls()!==1 ||
      m._pwp_mu_mouse_initialized()!==1 || m._pwp_mu_mouse_cursor_visible()!==0)
     throw new Error('Real _MS_INIT initialization contract not satisfied');
  }
 }
 if(state!==1){lastStatus=state;break;}
}
if(!seen||!reached||iocsQueries!==3||totalCalls!==9 || lastStatus!==1)
 throw new Error(`Real PANIC.X _MS_INIT advancement failed (seen=${seen}, pc=${m._pwp_mu_pc().toString(16)}, calls=${totalCalls}, iocs=${iocsQueries}, status=${lastStatus})`);
if(m._pwp_mu_video_pixel_writes()!==0)throw new Error('Unexpected pixels before PAN data is read');
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_PANIC_MS_INIT_PASS',
 actualMusashi:true,originalPanicX:true,mouseIOCS:0x70,pc:'0x10092',
 msInitCalls:1,mouseInitialized:true,cursorVisible:false,
 graphicsUse:3,textUse:2,instructions:m._pwp_mu_steps(),
 panFrameVerified:false}));
