#!/usr/bin/env node
/* Actual Musashi + original PANIC.X acceptance for FF37. Explicitly NOT
 * PAN playback. No mock core is accepted because a real .wasm must run. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath,exePath]=process.argv.slice(2);
if(!modulePath||!exePath)throw Error('Usage: RUN_R16_FIX8_NAMECK_CPU.mjs pwp_musashi.mjs PANIC.X');
const exe=readFileSync(resolve(exePath));
if(createHash('sha256').update(exe).digest('hex')!==
 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd')
 throw Error('Authentic PANIC.X SHA256 mismatch');
const {default:factory}=await import(pathToFileURL(resolve(modulePath)).href);
const m=await factory();
const required=['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_set_pan_size',
 '_pwp_mu_run','_pwp_mu_dispatch','_pwp_mu_pc','_pwp_mu_trap_pc','_pwp_mu_trap',
 '_pwp_mu_register','_pwp_mu_guest_peek8','_pwp_mu_status','_pwp_mu_steps'];
for(const n of required)if(typeof m[n]!=='function')throw Error('Missing Musashi WASM ABI: '+n);
const ptr=m._pwp_mu_stage_ptr()>>>0;
if(!(m.HEAPU8 instanceof Uint8Array)||exe.length>m._pwp_mu_stage_capacity()||
 ptr>m.HEAPU8.length-exe.length)throw Error('WASM loading bounds invalid');
m.HEAPU8.set(exe,ptr);
if(m._pwp_mu_load(exe.length)!==1)throw Error('Real original PANIC.X HU loader failed');
// Mount metadata only: no fabricated PNG/PAN frame and no host file data.
m._pwp_mu_set_pan_size(0,54272);
const b=a=>m._pwp_mu_guest_peek8(a)>>>0;
const read16=a=>(b(a)<<8)|b(a+1);
const read32=a=>((read16(a)<<16)|read16(a+2))>>>0;
const str=(a,cap)=>{
 if(a<0x10000||a>0x400000-cap)throw Error('Unsafe guest string pointer');
 let result='';for(let i=0;i<cap;i++){let v=b(a+i);if(v===0)return result;if(v<32||v>126)throw Error('Non ASCII filename');result+=String.fromCharCode(v);}
 throw Error('Guest string not terminated within cap');
};
let called=0,seenMouse=false,success=false;
for(let i=0;i<20000;i++){
 let state=m._pwp_mu_run(1);
 if(state===2){
   const op=m._pwp_mu_trap()>>>0,pc=m._pwp_mu_trap_pc()>>>0;
   if(op===0xff37){
     if(pc!==0x1009a||!seenMouse||called!==9)throw Error('Original PANIC.X wrong NAMECK call order');
     const sp=m._pwp_mu_register(15)>>>0;
     if(sp>0x400000-8)throw Error('NAMECK arguments outside guest RAM');
     const input=read32(sp),output=read32(sp+4);
     const original=str(input,256);
     if(!/^([Cc]:)?[\\/]?(P68K\.PAN)$/.test(original))throw Error('PANIC.X unexpected input filename '+original);
     if(output>0x400000-91)throw Error('NAMECK output buffer invalid');
     if(m._pwp_mu_dispatch()!==1||m._pwp_mu_pc()!==0x1009c||m._pwp_mu_register(0)!==0)
       throw Error('Genuine Musashi NAMECK DOS return failed');
     const getStr=(ofs,n)=>{let out='';for(let j=0;j<n;j++){const v=b(output+ofs+j);if(!v)break;out+=String.fromCharCode(v);}return out;};
     if(b(output)!==67||b(output+1)!==58||getStr(2,65)!=='\\'||
       getStr(67,19)!=='P68K'||getStr(86,5)!=='.PAN')
       throw Error('Wrong 91-byte Human68k NAMECK expansion');
     success=true;break;
   }
   if(op===0x4e4f){
     const fn=m._pwp_mu_register(0)&255;
     if(fn===0x70)seenMouse=true;
     else if(fn!==0x0e)throw Error(`Unexpected IOCS $${fn.toString(16)}`);
   }else if(![0xff4a,0xff48,0xff20,0xff25].includes(op))throw Error(`Unexpected DOS $${op.toString(16)} at ${pc.toString(16)}`);
   called++;
   state=m._pwp_mu_dispatch();
 }
 if(state!==1)throw Error('Real CPU stopped before NAMECK: status='+state);
}
if(!success)throw Error('Genuine PANIC.X never reached FF37');
if(!seenMouse)throw Error('Missing preceding IOCS _MS_INIT');
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_PANIC_NAMECK_PASS',
 actualMusashi:true,actualPanicX:true,opcode:'0xff37',pc:'0x1009a',
 postPc:'0x1009c',parsedFile:'C:\\P68K.PAN',bufferBytes:91,
 dosCallsBeforeNameck:called,ranInstructions:m._pwp_mu_steps(),panFrameVerified:false}));
