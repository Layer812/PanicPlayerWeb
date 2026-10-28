#!/usr/bin/env node
/* Run an authentic .X through actual Musashi until the first unsupported
 * Human68k/IOCS service, genuine _KEEPPR, or controlled CPU failure.
 * This is an evidence probe, NOT a music playback or Z-MUSIC install pass.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const target=resolve(process.argv[2]);
const file=readFileSync(resolve(process.argv[3]));
assert.equal(file[0],0x48);assert.equal(file[1],0x55);
const wasm=await (await import(pathToFileURL(target).href)).default();
const put=data=>{
  const pos=wasm._pwp_mu_stage_ptr()>>>0;
  assert.ok(data.length<=(wasm._pwp_mu_stage_capacity()>>>0));
  wasm.HEAPU8.set(data,pos);
};
const hu=new Uint8Array(68);
hu[0]=0x48;hu[1]=0x55;new DataView(hu.buffer).setUint32(12,4,false);
hu.set([0x70,0x2a,0xff,0x4c],64);
put(hu);assert.equal(wasm._pwp_mu_load(hu.length),1);
put(file);
const begun=wasm._pwp_mu_tsr_begin(file.length);
if(begun!==1)throw new Error('Actual ZMUSIC208.X staging refused: '+begun);
let completed=0, calls=0, status=1, last=null;
const services=[];
for(let i=0;i<20000;i++){
  const current=wasm._pwp_mu_run(512);
  if(current===1){status=1;continue;}
  if(current===2){
    calls++;
    const op=wasm._pwp_mu_trap()>>>0;
    const d0=wasm._pwp_mu_register(0)>>>0;
    const pc=wasm._pwp_mu_pc()>>>0;
    last={op:'0x'+op.toString(16),fn:'0x'+(d0&255).toString(16),
          pc:'0x'+pc.toString(16),cycles:wasm._pwp_mu_guest_cycles()};
    if(services.length<32)services.push({...last});
    const dispatched=wasm._pwp_mu_dispatch();
    if(dispatched===1){
      if(wasm._pwp_mu_tsr_phase()===2){completed=1;status=1;break;}
      continue;
    }
    status=dispatched;
    break;
  }
  status=current;break;
}
const result={driver:'AUTHENTIC_ZMUSIC208.X',guestCpu:'REAL_MUSASHI',
  bytes:file.length,initialized:wasm._pwp_mu_tsr_phase()===2,
  completed, status,pc:'0x'+(wasm._pwp_mu_pc()>>>0).toString(16),
  fault:'0x'+(wasm._pwp_mu_fault_address()>>>0).toString(16),
  calls, last, services,
  note:'Not a Z-MUSIC playback pass unless real _KEEPPR and guest trap-vector signature are confirmed'};
console.log('ZMUSIC REAL BOOT EVIDENCE '+JSON.stringify(result));
if(calls<3 && !completed)process.exitCode=2; // real driver must advance beyond _FNTGET
