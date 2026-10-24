// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* Developer-only Musashi PANIC.X startup trace. This never claims playback. */
import {verifyPanicX} from './hu-startup-probe.mjs';
export async function musashiProbe(binary,{createModule}={}){
  verifyPanicX(binary);
  if(!createModule){
    const imported=await import('../core/pwp_musashi.mjs');
    createModule=imported.default;
  }
  const m=await createModule();
  const ptr=m._pwp_mu_stage_ptr();
  if(binary.length>m._pwp_mu_stage_capacity()) throw Error('HU stage capacity exceeded');
  m.HEAPU8.set(binary,ptr);
  const loaded=m._pwp_mu_load(binary.length);
  if(loaded!==1)throw Error('HU load status '+loaded);
  const trace=[];
  for(let i=0;i<10;i++){
    const state=m._pwp_mu_run(2000);
    const info={state,pc:m._pwp_mu_pc(),trap:m._pwp_mu_trap(),trapPC:m._pwp_mu_trap_pc(),steps:m._pwp_mu_steps()};
    trace.push(info);
    if(state!==2)break;
    if(info.trap!==0xff4a)break;
    const dispatched=m._pwp_mu_dispatch();
    trace.push({service:'SETBLOCK',result:dispatched,d0:m._pwp_mu_register(0),pc:m._pwp_mu_pc()});
    if(dispatched!==1)break;
  }
  return {trace,playable:false};
}
