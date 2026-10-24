#!/usr/bin/env node
/* FIX10 acceptance: actual Musashi WASM executes synthetic HU IOCS CRTMOD.
 * Does NOT claim PAN frame decoding. Authenticated PANIC.X + genuine PAN input
 * is exercised separately by RUN_R16_PANIC_DEEP in the one-pass runner. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const mod=process.argv[2];
if(!mod) throw Error('Usage: node RUN_R16_FIX10_CRTMOD_CPU.mjs path/pwp_musashi.mjs');
const {default:factory}=await import(pathToFileURL(resolve(mod)).href);
const m=await factory();
for(const k of ['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_run',
 '_pwp_mu_dispatch','_pwp_mu_status','_pwp_mu_register','_pwp_mu_trap','_pwp_mu_trap_pc',
 '_pwp_mu_iocs_crt_mode','_pwp_mu_iocs_crtmod_calls','_pwp_mu_pc']){
 if(typeof m[k]!=='function')throw Error('Missing real Musashi WASM ABI: '+k);
}
// MOVEQ #10,D1; MOVEQ #$10,D0; TRAP #15; query D1=-1; TRAP #15;
// request unsupported mode 11 -> must STOP and retain mode 10.
const words=[0x720a,0x7010,0x4e4f,0x72ff,0x7010,0x4e4f,0x720b,0x7010,0x4e4f,0x4e71];
const b=new Uint8Array(64+words.length*2);
b[0]=0x48;b[1]=0x55;
const n=words.length*2;
b[12]=(n>>>24)&255;b[13]=(n>>>16)&255;b[14]=(n>>>8)&255;b[15]=n&255;
for(let i=0;i<words.length;i++){b[64+i*2]=words[i]>>>8;b[65+i*2]=words[i]&255;}
const ptr=m._pwp_mu_stage_ptr()>>>0;
if(b.length>m._pwp_mu_stage_capacity() || ptr>m.HEAPU8.length-b.length)throw Error('HU staging bounds');
m.HEAPU8.set(b,ptr);
if(m._pwp_mu_load(b.length)!==1)throw Error('Actual Musashi cannot load HU');
if(m._pwp_mu_iocs_crt_mode()!==0 || m._pwp_mu_iocs_crtmod_calls()!==0)throw Error('No initial CRT reset');
const expected=[
 {pc:0x10004,ok:true,mode:10,d0:0,calls:1},
 {pc:0x1000a,ok:true,mode:10,d0:10,calls:2},
 {pc:0x10010,ok:false,mode:10,d0:16,calls:2},
];
let i=0;
for(let j=0;j<60&&i<expected.length;j++){
 const status=m._pwp_mu_run(1);
 if(status===2){
  const e=expected[i];
  if(m._pwp_mu_trap()!==0x4e4f||m._pwp_mu_trap_pc()!==e.pc)throw Error('Unexpected IOCS at '+(m._pwp_mu_trap_pc()>>>0).toString(16));
  const rc=m._pwp_mu_dispatch();
  if(rc!==(e.ok?1:2) || m._pwp_mu_pc()!==(e.pc+(e.ok?2:0)))throw Error('IOCS CRTMOD dispatch incorrect at '+i);
  if(m._pwp_mu_iocs_crt_mode()!==e.mode || m._pwp_mu_iocs_crtmod_calls()!==e.calls ||
      (m._pwp_mu_register(0)|0)!==e.d0)throw Error('CRTMOD state/return failed '+i);
  i++;
 } else if(status!==1)throw Error('Real CPU stopped unexpectedly '+status);
}
if(i!==3)throw Error('Did not reach three real Musashi IOCS CRTMOD traps');
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_CRTMOD10_SEMANTICS_PASS',
 actualMusashi:true,syntheticHU:true,actualPanicX:false,mode:10,calls:2,
 rejectedMode11:true,framesDecoded:false}));
