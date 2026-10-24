#!/usr/bin/env node
/* Genuine Musashi 68000 test on a synthetic 68000 HU file.
 * Proves the actual WASM host adapter's FF23 handling: NOT real movie decode. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const mod=process.argv[2];
if(!mod)throw Error('Usage: node RUN_R16_FIX9_CONCTRL_CPU.mjs path/pwp_musashi.mjs');
const {default:factory}=await import(pathToFileURL(resolve(mod)).href);
const m=await factory();
for(const k of ['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_run',
 '_pwp_mu_dispatch','_pwp_mu_status','_pwp_mu_register','_pwp_mu_trap','_pwp_mu_trap_pc',
 '_pwp_mu_conctrl_calls','_pwp_mu_conctrl_screen_mode','_pwp_mu_conctrl_fnkeys_mode',
 '_pwp_mu_conctrl_cursor_visible','_pwp_mu_pc']){
 if(typeof m[k]!=='function')throw Error('Missing real WASM function: '+k);
}
// Actual M68000 MOVEs and F-line calls, not a mock CPU:
//   MOVE.L #$0010ffff,-(A7); DC.W $ff23
//   MOVE.L #$000effff,-(A7); DC.W $ff23
//   MOVE.L #$000e0002,-(A7); DC.W $ff23
//   MOVE.W #$0012,-(A7); DC.W $ff23
//   MOVE.W #$0011,-(A7); DC.W $ff23
const words=[0x2f3c,0x0010,0xffff,0xff23,
             0x2f3c,0x000e,0xffff,0xff23,
             0x2f3c,0x000e,0x0002,0xff23,
             0x3f3c,0x0012,0xff23,
             0x3f3c,0x0011,0xff23,
             // FIX30: restoring initial no-graphics console mode on PANIC.X exit.
             0x3f3c,0x0000,0x3f3c,0x0010,0xff23,0x4e71];
const binary=new Uint8Array(64+words.length*2);
binary[0]=0x48;binary[1]=0x55; // HU, not PANIC.X
const n=words.length*2;
binary[12]=(n>>>24)&255;binary[13]=(n>>>16)&255;binary[14]=(n>>>8)&255;binary[15]=n&255;
for(let i=0;i<words.length;i++){
 binary[64+i*2]=words[i]>>>8;
 binary[65+i*2]=words[i]&255;
}
const p=m._pwp_mu_stage_ptr()>>>0;
if(p>m.HEAPU8.length-binary.length || binary.length>m._pwp_mu_stage_capacity())throw Error('Unsafe HU stage');
m.HEAPU8.set(binary,p);
if(m._pwp_mu_load(binary.length)!==1)throw Error('Real Musashi failed HU loader');
const expected=[
 {pc:0x10006,result:0,fn:0,cursor:1},
 {pc:0x1000e,result:0,fn:0,cursor:1},
 {pc:0x10016,result:0,fn:2,cursor:1},
 {pc:0x1001c,result:0,fn:2,cursor:0},
 {pc:0x10022,result:0,fn:2,cursor:1},
 {pc:0x1002c,result:0,fn:2,cursor:1},
];
let i=0;
for(let iter=0;iter<120 && i<expected.length;iter++){
 const status=m._pwp_mu_run(1);
 if(status===2){
  const e=expected[i];
  if(m._pwp_mu_trap()!==0xff23 || m._pwp_mu_trap_pc()!==e.pc)
    throw Error('Wrong actual CPU FF23 PC '+(m._pwp_mu_trap_pc()>>>0).toString(16));
  if(m._pwp_mu_dispatch()!==1 || m._pwp_mu_pc()!==e.pc+2)
    throw Error('Real Musashi FF23 dispatch failed');
  if((m._pwp_mu_register(0)|0)!==e.result || m._pwp_mu_conctrl_fnkeys_mode()!==e.fn ||
      m._pwp_mu_conctrl_cursor_visible()!==e.cursor || m._pwp_mu_conctrl_screen_mode()!==0)
    throw Error('Real Musashi FF23 result/state differs at '+i);
  i++;
 }else if(status!==1)throw Error('Real Musashi stopped at '+m._pwp_mu_pc().toString(16));
}
if(i!==expected.length || m._pwp_mu_conctrl_calls()!==6)
 throw Error('Did not execute six real Musashi DOS FF23 calls');
console.log(JSON.stringify({result:'REAL_MUSASHI_WASM_CONCTRL_SEMANTICS_PASS',
 actualMusashi:true,syntheticHU:true,realPanicX:false,dosFF23Calls:i,consoleRestoreMode0Verified:true,
 framesDecoded:false}));
