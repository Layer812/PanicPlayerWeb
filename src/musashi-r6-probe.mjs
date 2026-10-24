// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** R6 research-only boot trace: real Musashi is required at runtime.
 * No rendered frame/audio; the result NEVER claims PAN playback.
 * The WASM module is generated only from the pinned original Musashi source.
 */
import {verifyPanicX} from './hu-startup-probe.mjs';
import {mountPanBlob, servicePanRead} from './musashi-dos-io.mjs';

function gatherConsole(m) {
  const length=m._pwp_mu_console_length()>>>0;
  if(length>8192) throw new RangeError('Guest output exceeded bounded diagnostic buffer');
  const bytes=Uint8Array.from({length},(_,i)=>m._pwp_mu_console_byte(i)&255);
  let decoded;
  try { decoded=new TextDecoder('shift_jis').decode(bytes); }
  catch { decoded=new TextDecoder().decode(bytes); }
  return {text:decoded,byteCount:length,truncated:!!m._pwp_mu_console_truncated()};
}

export async function runR6Probe(binary, panBlob, {createModule, maxBatches=500}={}) {
  verifyPanicX(binary);
  if(!Number.isInteger(maxBatches)||maxBatches<1||maxBatches>10000)
    throw new RangeError('maxBatches must be an integer from 1 to 10000');
  if(!createModule)createModule=(await import('../core/pwp_musashi.mjs')).default;
  const m=await createModule();
  if(!m?.HEAPU8)throw Error('Real Musashi WASM module has no linear-memory view');
  const ptr=m._pwp_mu_stage_ptr()>>>0;
  const capacity=m._pwp_mu_stage_capacity()>>>0;
  if(binary.length>capacity||ptr>m.HEAPU8.length || binary.length>m.HEAPU8.length-ptr)
    throw new RangeError('PANIC HU staging area exceeds WASM memory');
  m.HEAPU8.set(binary,ptr);
  const loaded=m._pwp_mu_load(binary.length);
  if(loaded!==1)throw new Error(`PANIC HU image rejected (${loaded})`);
  mountPanBlob(m,panBlob);
  const trace=[];
  let budgetExhausted=true;
  for(let i=0;i<maxBatches;i++) {
    const before=m._pwp_mu_status();
    if(before===1){
      m._pwp_mu_run(2000);
      continue;
    }
    if(before===3){
      const read=await servicePanRead(m,panBlob);
      trace.push({event:'READ',offset:read.offset,bytes:read.read});
      continue;
    }
    if(before===2){
      const op=m._pwp_mu_trap()>>>0,pc=m._pwp_mu_trap_pc()>>>0;
      const after=m._pwp_mu_dispatch();
      trace.push({event:'DOS',op:`0x${op.toString(16).padStart(4,'0')}`,pc,
        status:after,d0:m._pwp_mu_register(0)|0});
      if(after!==2)continue;
    }
    budgetExhausted=false;
    break;
  }
  const state=m._pwp_mu_status();
  const diagnostics={
    playable:false,
    guestInstructions:m._pwp_mu_steps()>>>0,
    state,
    exitCode:state===4?(m._pwp_mu_exit_code()>>>0):null,
    pc:m._pwp_mu_pc()>>>0,
    stopOpcode:state===2?`0x${(m._pwp_mu_trap()>>>0).toString(16).padStart(4,'0')}`:null,
    exhausted:budgetExhausted,
    console:gatherConsole(m),
    trace
  };
  return diagnostics;
}
