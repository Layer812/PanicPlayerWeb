#!/usr/bin/env node
/* FIX11 real Musashi WASM acceptance: synthetic HU CRTMOD(10) -> G_CLR_ON.
 * This checks actual 68000 instruction execution but NOT movie rendering. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const file=process.argv[2];
if(!file)throw Error('Usage: node RUN_R16_FIX11_GCLR_CPU.mjs path/to/pwp_musashi.mjs');
const {default:factory}=await import(pathToFileURL(resolve(file)).href);
const m=await factory();
const ABI=['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_run','_pwp_mu_dispatch',
 '_pwp_mu_pc','_pwp_mu_trap','_pwp_mu_trap_pc','_pwp_mu_iocs_crt_mode',
 '_pwp_mu_iocs_gclr_calls','_pwp_mu_graphics_display_enabled','_pwp_mu_graphics_clear_count',
 '_pwp_mu_graphics_access_page','_pwp_mu_video_pixel_writes','_pwp_mu_register'];
for(const k of ABI)if(typeof m[k]!=='function')throw Error('Missing actual Musashi WASM export '+k);
function load(words){
 const bytes=new Uint8Array(64+words.length*2);bytes[0]=0x48;bytes[1]=0x55;
 const size=words.length*2;bytes[12]=size>>>24;bytes[13]=size>>>16;bytes[14]=size>>>8;bytes[15]=size;
 words.forEach((x,i)=>{bytes[64+2*i]=x>>>8;bytes[65+2*i]=x&255;});
 const ptr=m._pwp_mu_stage_ptr()>>>0;
 if(ptr+bytes.length>m.HEAPU8.length||bytes.length>m._pwp_mu_stage_capacity())throw Error('Unsafe HU stage');
 m.HEAPU8.set(bytes,ptr);
 if(m._pwp_mu_load(bytes.length)!==1)throw Error('Synthetic HU load failed');
}
function traps(expect){
 let i=0;
 for(let t=0;t<80&&i<expect.length;t++){
  const status=m._pwp_mu_run(1);
  if(status===2){
   const e=expect[i];
   if(m._pwp_mu_trap()!==0x4e4f || (m._pwp_mu_trap_pc()>>>0)!==e.pc)throw Error('Wrong real trap '+i);
   const next=m._pwp_mu_dispatch();
   if(next!==(e.ok?1:2))throw Error('Unexpected IOCS handler status '+i);
   if(m._pwp_mu_pc()!==(e.pc+(e.ok?2:0)))throw Error('IOCS PC incorrect '+i);
   if(m._pwp_mu_iocs_gclr_calls()!==e.clears ||
      m._pwp_mu_graphics_clear_count()!==e.clears ||
      !!m._pwp_mu_graphics_display_enabled()!==e.enabled ||
      m._pwp_mu_iocs_crt_mode()!==e.mode)throw Error('Real graphics state incorrect '+i);
   if(e.ok && e.clears>0 && m._pwp_mu_graphics_access_page()!==0)throw Error('Nonzero access page after clear');
   if(m._pwp_mu_video_pixel_writes()!==0)throw Error('Initialization falsely counted as decoded pixels');
   ++i;
  }else if(status!==1)throw Error('Synthetic genuine Musashi CPU unexpected status '+status);
 }
 if(i!==expect.length)throw Error('Missing IOCS traps: '+i);
}
// MOVEQ #-112,D0; TRAP #15 should remain blocked without CRTMOD.
load([0x7090,0x4e4f,0x4e71]);
traps([{pc:0x10002,ok:false,clears:0,enabled:false,mode:0}]);
// MOVEQ #10,D1; MOVEQ #16,D0; TRAP; MOVEQ #-112,D0; TRAP; TRAP repeat.
load([0x720a,0x7010,0x4e4f,0x7090,0x4e4f,0x7090,0x4e4f,0x4e71]);
traps([{pc:0x10004,ok:true,clears:0,enabled:false,mode:10},
       {pc:0x10008,ok:true,clears:1,enabled:true,mode:10},
       {pc:0x1000c,ok:true,clears:2,enabled:true,mode:10}]);
load([0x7090,0x4e4f,0x4e71]);
traps([{pc:0x10002,ok:false,clears:0,enabled:false,mode:0}]);
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_GCLR_ON10_SEMANTICS_PASS',
 realMusashi:true,syntheticHU:true,actualPanicX:false,initializationClears:2,
 invalidBeforeCrtmodRejected:true,resetReverified:true,decodedMovieFrames:false}));
