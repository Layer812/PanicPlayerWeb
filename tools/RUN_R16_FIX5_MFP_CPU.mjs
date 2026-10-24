#!/usr/bin/env node
/* Real Musashi acceptance gate: original PANIC.X must execute BOTH MFP
 * register reads; no synthetic CPU, no bypass, no fake PAN rendering.
 * The registers are backed by the X68KTab5 MFP_Init() IERB/IMRB values.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [a,b]=process.argv.slice(2);
if(!a||!b)throw new Error('Usage: RUN_R16_FIX5_MFP_CPU.mjs pwp_musashi.mjs PANIC.X');
const hu=readFileSync(resolve(b));
if(createHash('sha256').update(hu).digest('hex')!=='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd')
  throw new Error('Not authenticated original PANIC.X V1.38');
const {default:create}=await import(pathToFileURL(resolve(a)).href);
const m=await create();
for(const fn of ['_pwp_mu_load','_pwp_mu_run','_pwp_mu_status','_pwp_mu_register','_pwp_mu_dispatch',
 '_pwp_mu_mfp_ierb_reads','_pwp_mu_mfp_imrb_reads','_pwp_mu_mfp_last_read_address','_pwp_mu_fault_address'])
 if(typeof m[fn]!=='function')throw new Error('Missing genuine WASM ABI '+fn);
const stage=m._pwp_mu_stage_ptr()>>>0;
if(stage>m.HEAPU8.length-hu.length||hu.length>m._pwp_mu_stage_capacity())throw new Error('HU staging overflow');
m.HEAPU8.set(hu,stage);
if(m._pwp_mu_load(hu.length)!==1)throw new Error('HU load failed');
m._pwp_mu_set_pan_size(0,54272);
const ops=[];
let matched=false;
for(let i=0;i<1000;i++){
  const pc=m._pwp_mu_pc()>>>0;
  if(pc===0x10054){
    if((m._pwp_mu_mfp_ierb_reads()>>>0)!==1||(m._pwp_mu_mfp_imrb_reads()>>>0)!==1||
       (m._pwp_mu_mfp_last_read_address()>>>0)!==0xe88015||(m._pwp_mu_register(0)&255)!==0x3e)
      throw new Error('MFP register values or real CPU reads differ from X68KTab5 MFP_Init: '+JSON.stringify({ierb:m._pwp_mu_mfp_ierb_reads(),imrb:m._pwp_mu_mfp_imrb_reads(),d0:m._pwp_mu_register(0)}));
    matched=true;break;
  }
  let st=m._pwp_mu_run(1);
  if(st===2){
    const op=m._pwp_mu_trap()>>>0;
    ops.push(op);
    if(ops.length>3||op!==[0xff4a,0xff48,0xff20][ops.length-1])throw new Error('Unrecognized original PANIC.X DOS startup trap');
    st=m._pwp_mu_dispatch();
    if(st!==1)throw new Error('Original PANIC.X DOS failed '+st);
  }
  if(st!==1)throw new Error('CPU stopped while testing authentic MFP reads: '+JSON.stringify({status:st,pc:m._pwp_mu_pc(),fault:m._pwp_mu_fault_address(),ops}));
}
if(!matched||ops.length!==3)throw new Error('Original PANIC.X did not execute BOTH MFP reads');
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_PANIC_MFP_READ_PASS',actualPanicX:true,
 pc:'0x10054',mfpIERB:'0x3e',mfpIMRB:'0x3e',mfpIERBReads:m._pwp_mu_mfp_ierb_reads(),
 mfpIMRBReads:m._pwp_mu_mfp_imrb_reads(),registerD0:m._pwp_mu_register(0)&255,
 startupDOS:ops.map(x=>'0x'+x.toString(16)),instructionCount:m._pwp_mu_steps(),
 panFrameVerified:false}));
