// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* R5 research-only runtime: intercepts I/O but does not render PAN video/audio. */
import {verifyPanicX} from './hu-startup-probe.mjs';
import {mountPanBlob, servicePanRead} from './musashi-dos-io.mjs';
export async function runR5Probe(binary, panBlob, {createModule, maxBatches=300}={}) {
  verifyPanicX(binary);
  if (!createModule) createModule=(await import('../core/pwp_musashi.mjs')).default;
  const m=await createModule();
  const ptr=m._pwp_mu_stage_ptr();
  if(binary.byteLength>m._pwp_mu_stage_capacity())throw Error('PANIC.X exceeds HU staging area');
  m.HEAPU8.set(binary,ptr);
  const loaded=m._pwp_mu_load(binary.length);
  if(loaded!==1)throw Error(`Invalid PANIC HU image (${loaded})`);
  mountPanBlob(m,panBlob);
  const trace=[];
  for(let i=0;i<maxBatches;i++){
    const state=m._pwp_mu_status();
    if(state===1){m._pwp_mu_run(2000);continue;}
    if(state===3){
      const detail=await servicePanRead(m,panBlob);
      trace.push({type:'READ',bytes:detail.read,offset:detail.offset});
      continue;
    }
    if(state!==2){trace.push({type:'STOP',state,pc:m._pwp_mu_pc()});break;}
    const trap=m._pwp_mu_trap()>>>0;
    const pc=m._pwp_mu_trap_pc()>>>0;
    const result=m._pwp_mu_dispatch();
    trace.push({type:'DOS',trap:`0x${trap.toString(16)}`,pc,status:result,
      d0:m._pwp_mu_register(0)});
    if(result===2)break;
  }
  return {playable:false,guestSteps:m._pwp_mu_steps(),state:m._pwp_mu_status(),trace};
}
