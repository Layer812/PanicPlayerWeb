#!/usr/bin/env node
/* FIX45: actual Musashi 68000 executes FF06/FF0C, no fake keyboard or CPU.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
 * Synthetic HU isolates DOS keyboard semantics; this does not claim a PAN
 * animation finished. */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const mod=process.argv[2];
if(!mod)throw Error('Usage: node RUN_FIX45_SPACE_REAL_CPU.mjs core/pwp_musashi.mjs');
const {default:factory}=await import(pathToFileURL(resolve(mod)).href);
const m=await factory();
for(const api of ['_pwp_mu_load','_pwp_mu_stage_ptr','_pwp_mu_stage_capacity',
 '_pwp_mu_run','_pwp_mu_dispatch','_pwp_mu_trap','_pwp_mu_register',
 '_pwp_mu_queue_space','_pwp_mu_pending_space','_pwp_mu_consumed_space',
 '_pwp_mu_rejected_space'])
  assert.equal(typeof m[api],'function',api);
// Five guest DOS calls:
// 1. FF06($FF) -> 0 empty
// 2. FF06($FF) -> SPACE after one host keydown
// 3. FF06($FF) -> 0, queue consumed exactly once
// 4. FF0C($FFFF) -> flush one pending SPACE
// 5. FF06($FF) -> 0 after flush
const words=[
 0x3f3c,0x00ff,0xff06,0x548f,
 0x3f3c,0x00ff,0xff06,0x548f,
 0x3f3c,0x00ff,0xff06,0x548f,
 0x3f3c,0xffff,0xff0c,0x548f,
 0x3f3c,0x00ff,0xff06,0x548f,
 0x4e71
];
const hu=new Uint8Array(64+words.length*2);
hu[0]=0x48;hu[1]=0x55; // authentic Human68k HU header shape
const n=words.length*2;
hu[12]=n>>>24;hu[13]=(n>>>16)&255;hu[14]=(n>>>8)&255;hu[15]=n&255;
for(let i=0;i<words.length;i++){hu[64+i*2]=words[i]>>>8;hu[65+i*2]=words[i]&255;}
assert.ok(hu.length<=m._pwp_mu_stage_capacity());
m.HEAPU8.set(hu,m._pwp_mu_stage_ptr());
assert.equal(m._pwp_mu_load(hu.length),1);
const want=[{op:0xff06,value:0},{op:0xff06,value:0x20},
 {op:0xff06,value:0},{op:0xff0c,value:0},{op:0xff06,value:0}];
let completed=0;
for(let i=0;i<500 && completed<want.length;i++){
 const status=m._pwp_mu_run(1);
 assert.ok(status===1 || status===2,'CPU state='+status);
 if(status!==2)continue;
 const e=want[completed];
 assert.equal(m._pwp_mu_trap(),e.op,'call '+completed);
 if(completed===1){assert.equal(m._pwp_mu_pending_space(),1);}
 assert.equal(m._pwp_mu_dispatch(),1);
 assert.equal(m._pwp_mu_register(0)>>>0,e.value,'DOS D0 call '+completed);
 ++completed;
 if(completed===1){
   assert.equal(m._pwp_mu_queue_space(),1);
   assert.equal(m._pwp_mu_pending_space(),1);
 }
 if(completed===2)assert.equal(m._pwp_mu_pending_space(),0);
 if(completed===3) {
   /* A real browser key event arrives BETWEEN CPU slices, not while
    * the synchronous DOS dispatch has suspended the guest in state 2. */
   assert.equal(m._pwp_mu_queue_space(),1);
   assert.equal(m._pwp_mu_pending_space(),1);
 }
 if(completed===4)assert.equal(m._pwp_mu_pending_space(),0);
}
assert.equal(completed,5,'all authentic guest DOS calls executed');
assert.equal(m._pwp_mu_consumed_space(),1);
assert.equal(m._pwp_mu_rejected_space(),0);
for(let i=0;i<16;i++)assert.equal(m._pwp_mu_queue_space(),1);
assert.equal(m._pwp_mu_queue_space(),0);
assert.equal(m._pwp_mu_pending_space(),16);
assert.equal(m._pwp_mu_rejected_space(),1);
console.log(JSON.stringify({result:'FIX45_GENUINE_MUSASHI_SPACE_INPUT_PASS',
  guestDosCalls:completed,guestAscii:0x20,consumed:1,
  flush:true,maxQueue:16,noKeyboardHardwareFaked:true}));
