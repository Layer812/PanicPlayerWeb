import test from 'node:test';
import assert from 'node:assert/strict';
import {runR6Probe} from '../src/musashi-r6-probe.mjs';
// Synthetic test double: validates only JS orchestration, not 68000 execution.
const data=new Uint8Array(15412);
data.set([0x48,0x55]);
const dv=new DataView(data.buffer);
dv.setUint32(12,0x39a2);dv.setUint32(16,0x252);dv.setUint32(20,0x1772);
data.set([0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0,0x10,
 0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a],64);
function mock() {
  let status=0,step=0,exit=0;
  const out=[0x50,0x41,0x4e,0x49,0x43,0x0d,0x0a];
  return {
    HEAPU8:new Uint8Array(1200000),
    _pwp_mu_stage_ptr:()=>4096, _pwp_mu_stage_capacity:()=>1048576,
    _pwp_mu_load:()=>{status=1;return 1;},
    _pwp_mu_status:()=>status,
    _pwp_mu_set_pan_size:()=>{},
    _pwp_mu_run:()=>{status=2;step+=7;return status;},
    _pwp_mu_trap:()=>0xff4c,_pwp_mu_trap_pc:()=>0x10100,
    _pwp_mu_dispatch:()=>{status=4;exit=3;return status;},
    _pwp_mu_register:()=>0,
    _pwp_mu_pc:()=>0x10100,
    _pwp_mu_steps:()=>step,
    _pwp_mu_console_length:()=>out.length,
    _pwp_mu_console_byte:i=>out[i],
    _pwp_mu_console_truncated:()=>0,
    _pwp_mu_exit_code:()=>exit
  };
}
test('R6 probe traces synthetic normal exit without claiming playable',async()=>{
 const r=await runR6Probe(data,new Blob(['PAN']),{createModule:async()=>mock()});
 assert.equal(r.playable,false);
 assert.equal(r.state,4);
 assert.equal(r.exitCode,3);
 assert.equal(r.guestInstructions,7);
 assert.equal(r.console.text,'PANIC\r\n');
 assert.equal(r.trace[0].op,'0xff4c');
});
test('R6 probe refuses impossible batch budget',async()=>{
 await assert.rejects(runR6Probe(data,new Blob(),{maxBatches:0,createModule:async()=>mock()}),RangeError);
});
test('R6 probe rejects malformed module stage bounds',async()=>{
 const m=mock(); m._pwp_mu_stage_ptr=()=>1199999;
 await assert.rejects(runR6Probe(data,new Blob(),{createModule:async()=>m}),RangeError);
});
test('R6 probe marks exhausted budgets as not playable',async()=>{
 const r=await runR6Probe(data,new Blob(),{maxBatches:1,createModule:async()=>mock()});
 assert.equal(r.exhausted,true);
 assert.equal(r.state,2);
 assert.equal(r.playable,false);
});
