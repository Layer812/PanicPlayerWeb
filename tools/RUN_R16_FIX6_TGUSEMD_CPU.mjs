#!/usr/bin/env node
/* Mandatory authentic Musashi+original PANIC.X IOCS $0E gate.
 * Only previous boot DOS and MFP reads are supported; this is not playback.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [mod,exe]=process.argv.slice(2);
if(!mod||!exe)throw new Error('Usage: RUN_R16_FIX6_TGUSEMD_CPU.mjs pwp_musashi.mjs PANIC.X');
const hu=readFileSync(resolve(exe));
const hash=createHash('sha256').update(hu).digest('hex');
if(hash!=='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd')throw new Error('PANIC.X original SHA256 mismatch');
const {default:create}=await import(pathToFileURL(resolve(mod)).href);
const m=await create();
const req=['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_set_pan_size','_pwp_mu_run',
'_pwp_mu_trap','_pwp_mu_pc','_pwp_mu_register','_pwp_mu_dispatch','_pwp_mu_steps',
'_pwp_mu_iocs_tgusemd_calls','_pwp_mu_iocs_graphics_use','_pwp_mu_iocs_text_use'];
for(const fn of req)if(typeof m[fn]!=='function')throw new Error('Missing real WASM export: '+fn);
const p=m._pwp_mu_stage_ptr()>>>0;
if(p>m.HEAPU8.length-hu.length || hu.length>m._pwp_mu_stage_capacity())throw new Error('unsafe HU staging');
m.HEAPU8.set(hu,p);
if(m._pwp_mu_load(hu.length)!==1)throw new Error('PANIC.X load failed');
m._pwp_mu_set_pan_size(0,54272);
let matched=false, ops=[];
for(let i=0;i<3000;i++){
 const pc=m._pwp_mu_pc()>>>0;
 if(pc===0x10064 && ops.includes(0x4e4f)){
   if((m._pwp_mu_iocs_tgusemd_calls()>>>0)!==1 ||
      (m._pwp_mu_iocs_graphics_use()>>>0)!==0 ||
      (m._pwp_mu_iocs_text_use()>>>0)!==0 ||
      (m._pwp_mu_register(0)>>>0)!==0)
     throw new Error('Authenticated IOCS $0E query returned wrong old usage or mutated screen ownership');
   matched=true;break;
 }
 let state=m._pwp_mu_run(1);
 if(state===2){
   const op=m._pwp_mu_trap()>>>0;
   ops.push(op);
   if(op===0x4e4f){
     if(pc!==0x10062 || (m._pwp_mu_register(0)&255)!==0x0e ||
        (m._pwp_mu_register(1)&255)!==0 || (m._pwp_mu_register(2)&255)!==255)
       throw new Error('Wrong PANIC.X IOCS function, args or PC');
   }else if(ops.length>3 || op!==[0xff4a,0xff48,0xff20][ops.length-1])
     throw new Error('Unexpected startup DOS trap before first IOCS');
   state=m._pwp_mu_dispatch();
 }
 if(state!==1)throw new Error('Real Musashi startup stopped: '+state+' PC '+m._pwp_mu_pc().toString(16));
}
if(!matched || ops.join(',')!==[0xff4a,0xff48,0xff20,0x4e4f].join(','))
 throw new Error('Real PANIC.X failed exact IOCS first query acceptance');
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_PANIC_TGUSEMD_PASS',
 authenticPanicX:true,actualMusashi:true,queryIOCS:14,screen:0,oldUsage:0,
 graphicsUsageAfter:0,iocsCalls:m._pwp_mu_iocs_tgusemd_calls(),pc:'0x10064',
 instructions:m._pwp_mu_steps(),panFrameVerified:false}));
