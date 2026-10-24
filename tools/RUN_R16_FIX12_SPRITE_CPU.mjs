#!/usr/bin/env node
/* Real Musashi WASM CPU gate for narrow X68000 IOCS _SP_INIT and _SP_ON.
   Synthetic instructions only. Movie frames are NOT verified. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const file=process.argv[2];
if(!file)throw Error('Usage: node RUN_R16_FIX12_SPRITE_CPU.mjs pwp_musashi.mjs');
const {default:factory}=await import(pathToFileURL(resolve(file)).href);
const m=await factory();
const symbols=['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_run','_pwp_mu_dispatch','_pwp_mu_trap','_pwp_mu_trap_pc','_pwp_mu_pc','_pwp_mu_register','_pwp_mu_iocs_crt_mode','_pwp_mu_iocs_sp_init_calls','_pwp_mu_iocs_sp_on_calls','_pwp_mu_sprite_initialized','_pwp_mu_sprite_display_enabled','_pwp_mu_sprite_init_count','_pwp_mu_sprite_enable_count','_pwp_mu_video_pixel_writes'];
for(const k of symbols)if(typeof m[k]!=='function')throw Error('Missing real Musashi export '+k);
function load(words){
 const bytes=new Uint8Array(64+words.length*2);bytes[0]=0x48;bytes[1]=0x55;
 const n=words.length*2;bytes[12]=n>>>24;bytes[13]=n>>>16;bytes[14]=n>>>8;bytes[15]=n;
 for(let i=0;i<words.length;i++){bytes[64+i*2]=words[i]>>>8;bytes[65+i*2]=words[i]&255;}
 const ptr=m._pwp_mu_stage_ptr()>>>0;
 if(bytes.length>m._pwp_mu_stage_capacity()||ptr+bytes.length>m.HEAPU8.length)throw Error('Stage out of bounds');
 m.HEAPU8.set(bytes,ptr);
 if(m._pwp_mu_load(bytes.length)!==1)throw Error('Synthetic HU load failed');
}
function run(expected){
 let i=0;
 for(let t=0;t<150&&i<expected.length;t++){
  const state=m._pwp_mu_run(1);
  if(state!==1 && state!==2)throw Error('CPU stopped '+state);
  if(state!==2)continue;
  const want=expected[i++];
  if(m._pwp_mu_trap()!==0x4e4f || m._pwp_mu_trap_pc()!==want.pc)throw Error('Wrong real trap PC '+i);
  if((m._pwp_mu_register(0)&255)!==want.fn)throw Error('Wrong IOCS fn '+i);
  if(m._pwp_mu_dispatch()!==1)throw Error('IOCS did not complete '+i);
  if((m._pwp_mu_register(0)|0)!==want.ret)throw Error('IOCS returned wrong D0 '+i);
  if(m._pwp_mu_pc()!==want.pc+2)throw Error('IOCS PC not advanced '+i);
  if(m._pwp_mu_iocs_crt_mode()!==want.mode ||
   !!m._pwp_mu_sprite_initialized()!==want.initialized ||
   !!m._pwp_mu_sprite_display_enabled()!==want.visible ||
   m._pwp_mu_sprite_init_count()!==want.initCount ||
   m._pwp_mu_sprite_enable_count()!==want.onCount)throw Error('Sprite/BG state mismatch '+i);
  if(m._pwp_mu_video_pixel_writes()!==0)throw Error('Sprite init falsely counted as decoded movie');
 }
 if(i!==expected.length)throw Error('Missing IOCS traps '+i);
}
// Invalid before setting mode 10 returns documented -1, not success.
load([0x70c0,0x4e4f,0x70c1,0x4e4f,0x4e71]);
run([{pc:0x10002,fn:0xc0,ret:-1,mode:0,initialized:false,visible:false,initCount:0,onCount:0},
     {pc:0x10006,fn:0xc1,ret:-1,mode:0,initialized:false,visible:false,initCount:0,onCount:0}]);
// Mode10: init -> on -> reinit -> on. All via genuine 68000 instructions.
load([0x720a,0x7010,0x4e4f,0x70c0,0x4e4f,0x70c1,0x4e4f,0x70c0,0x4e4f,0x70c1,0x4e4f,0x4e71]);
run([{pc:0x10004,fn:0x10,ret:0,mode:10,initialized:false,visible:false,initCount:0,onCount:0},
     {pc:0x10008,fn:0xc0,ret:0,mode:10,initialized:true,visible:false,initCount:1,onCount:0},
     {pc:0x1000c,fn:0xc1,ret:0,mode:10,initialized:true,visible:true,initCount:1,onCount:1},
     {pc:0x10010,fn:0xc0,ret:0,mode:10,initialized:true,visible:false,initCount:2,onCount:1},
     {pc:0x10014,fn:0xc1,ret:0,mode:10,initialized:true,visible:true,initCount:2,onCount:2}]);
load([0x70c0,0x4e4f,0x4e71]);
run([{pc:0x10002,fn:0xc0,ret:-1,mode:0,initialized:false,visible:false,initCount:0,onCount:0}]);
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_SPRITE_INIT_ON10_SEMANTICS_PASS',actualMusashi:true,syntheticHU:true,actualPanicX:false,verifiedInitCalls:2,verifiedOnCalls:2,resetVerified:true,decodedMovieFrames:false}));
