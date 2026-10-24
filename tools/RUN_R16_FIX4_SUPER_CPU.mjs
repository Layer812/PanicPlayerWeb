#!/usr/bin/env node
/** Must execute REAL Musashi in the newly-built WASM, NOT a mock.
 * Verify the authenticated original PANIC.X reaches FF20 after successful
 * SETBLOCK/MALLOC, changes 68000 privilege bit, copies USP -> SSP and
 * returns its previous SSP, with the next guest instruction still runnable.
 * Also test the inverse transition on a separate synthetic HU.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [wasmPath, exePath]=process.argv.slice(2).map(s=>resolve(s));
if(!wasmPath||!exePath)throw new Error('Usage: RUN_R16_FIX4_SUPER_CPU.mjs pwp_musashi.mjs PANIC.X');
const hu=readFileSync(exePath);
const sha=createHash('sha256').update(hu).digest('hex');
if(sha!=='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd')throw new Error('Not the pinned genuine PANIC.X');
const {default:create}=await import(pathToFileURL(wasmPath).href);
const m=await create();
const stage=m._pwp_mu_stage_ptr()>>>0;
if(stage>m.HEAPU8.length-hu.length)throw new Error('Unsafe HU staging buffer');
m.HEAPU8.set(hu,stage);
if(m._pwp_mu_load(hu.length)!==1)throw new Error('Authentic HU load failed');
m._pwp_mu_set_pan_size(0,54272);
let count=0,superCalls=0;
for(let iteration=0;iteration<30;iteration++) {
  let st=m._pwp_mu_run(500);
  if(st!==2)throw new Error(`Unexpected CPU status ${st} before FF20`);
  const op=m._pwp_mu_trap()>>>0;
  count++;
  if(op===0xff20){
    superCalls++;
    if(count!==3)throw new Error('Unanticipated DOS order: SUPER expected after SETBLOCK MALLOC');
    if((m._pwp_mu_trap_pc()>>>0)!==0x10044)throw new Error('Wrong authentic PANIC.X _SUPER PC');
    const sr=m._pwp_mu_register(16)>>>0;
    const usp=m._pwp_mu_register(17)>>>0;
    const isp=m._pwp_mu_register(18)>>>0;
    const sp=m._pwp_mu_register(15)>>>0;
    const read=(a)=>m._pwp_mu_guest_peek32(a)>>>0;
    if(sr&0x2000 || (sp&1) || read(sp)!==0)throw new Error('PANIC.X did not request user -> supervisor with a zero stack arg');
    st=m._pwp_mu_dispatch();
    const afterSR=m._pwp_mu_register(16)>>>0;
    const afterSP=m._pwp_mu_register(15)>>>0;
    const afterUSP=m._pwp_mu_register(17)>>>0;
    const afterISP=m._pwp_mu_register(18)>>>0;
    const returned=m._pwp_mu_register(0)>>>0;
    if(st!==1 || !(afterSR&0x2000) || afterSP!==sp || afterUSP!==sp || afterISP!==sp || returned!==isp || m._pwp_mu_pc()!==0x10046) {
       throw new Error(`Real CPU _SUPER transition mismatch: ${JSON.stringify({st,sr,sp,usp,isp,afterSR,afterSP,afterUSP,afterISP,returned,pc:m._pwp_mu_pc()})}`);
    }
    const next=m._pwp_mu_run(1);
    if(next!==1 || m._pwp_mu_pc()!==0x10048 || (m._pwp_mu_register(15)>>>0)!==(sp+4))throw new Error('ADDQ following real PANIC.X FF20 failed');
    console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_PANIC_SUPER_PASS',path:'original PANIC.X',commands:count,superCalls,pc:'0x10048',sr:afterSR,usp:afterUSP,ssp:afterISP,previousSSP:isp,instructions:m._pwp_mu_steps()}));
    break;
  }
  if((count===1&&op!==0xff4a)||(count===2&&op!==0xff48))throw new Error(`Wrong startup DOS sequence: ${op.toString(16)}`);
  st=m._pwp_mu_dispatch();
  if(st!==1)throw new Error(`Real PANIC.X startup DOS failed: ${op.toString(16)}`);
  if(count===2 && (m._pwp_mu_register(0)>>>0)!==86912)throw new Error('256KiB workspace not allocated at known location');
}
if(superCalls!==1)throw new Error('PANIC.X never requested _SUPER');
// Independent real CPU synthetic HU: test round-trip of user->supervisor->user.
// Executable: CLR.L -(A7); FF20; ADDQ.L #4,A7; MOVE.L D0,-(A7);
// FF20; ADDQ.L #4,A7; FF00. The first SUPER returns saved SSP in D0.
const code=Uint8Array.from([0x42,0xa7,0xff,0x20,0x58,0x8f,0x2f,0x00,0xff,0x20,0x58,0x8f,0xff,0x00]);
const synthetic=new Uint8Array(64+code.length);
synthetic[0]=0x48;synthetic[1]=0x55;
synthetic[15]=code.length;
synthetic.set(code,64);
if(stage>m.HEAPU8.length-synthetic.length)throw new Error('Unsafe synthetic HU stage');
m.HEAPU8.set(synthetic,stage);
if(m._pwp_mu_load(synthetic.length)!==1)throw new Error('Synthetic HU load failed');
let seen=[];
for(let i=0;i<15;i++){
  const st=m._pwp_mu_run(300);
  if(st!==2)throw new Error('Synthetic real CPU did not reach DOS trap: '+st);
  const op=m._pwp_mu_trap()>>>0;
  if(![0xff20,0xff00].includes(op))throw new Error('Unexpected synthetic DOS op '+op.toString(16));
  const sp=m._pwp_mu_register(15)>>>0,sr=m._pwp_mu_register(16)>>>0;
  const arg=m._pwp_mu_guest_peek32(sp)>>>0;
  let returned;
  const aft=m._pwp_mu_dispatch();
  returned=m._pwp_mu_register(0)>>>0;
  seen.push({op,sr,arg,returnD0:returned,status:aft});
  if(seen.length===1 && (op!==0xff20 || arg!==0 || !(m._pwp_mu_register(16)&0x2000) || returned!==0x3f0000))throw new Error('Synthetic enter supervisor mismatch');
  if(seen.length===2 && (op!==0xff20 || arg!==0x3f0000 || !(sr&0x2000) || (m._pwp_mu_register(16)&0x2000) || (m._pwp_mu_register(15)>>>0)!==0x3efffc))throw new Error('Synthetic leave supervisor mismatch');
  if(seen.length===3){
    if(op!==0xff00 || aft!==4 || (m._pwp_mu_register(15)>>>0)!==0x3f0000)throw new Error('Synthetic round-trip did not return to full user stack');
    console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_SUPER_ROUNDTRIP_PASS',transitions:seen,finalSR:m._pwp_mu_register(16),finalSP:m._pwp_mu_register(15)}));
    break;
  }
}
if(seen.length!==3)throw new Error('No synthetic supervisor round-trip');
