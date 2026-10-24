import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGuestClockLimiter} from '../src/guest-clock.mjs';

test('FIX24: 68000 clock cycles cannot run ahead of wall time',async()=>{
 let t=0;let slept=0;
 const pacer=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{slept+=ms;t+=ms;},cpuHz:10_000_000,maxAheadMs:0.5});
 pacer.reset(0);
 await pacer.pace(100_000);
 assert.ok(t>=9.4 && t<=10.0,`wall ${t}ms`);
 assert.ok(slept>9,`sleep ${slept}ms`);
 assert.equal(pacer.stats().cycles,100_000);
 await pacer.pace(200_000);
 assert.ok(t>=19.4 && t<=20.0,`wall ${t}ms`);
});

test('FIX32: delayed browser paint does not reset the absolute guest deadline',async()=>{
 let t=0;let slept=0;
 const pacer=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{slept+=ms;t+=ms;},cpuHz:10_000_000,maxAheadMs:0.5});
 pacer.reset(0);
 t=120;
 await pacer.pace(100_000); // guest: 10ms; late by 110ms
 assert.equal(slept,0);assert.equal(pacer.stats().resyncs,0);
 assert.ok(pacer.lateMs()>100);
 await pacer.pace(200_000); // catch up guest cycles, without added host wait
 assert.equal(slept,0);assert.ok(pacer.lateMs()>90);
});

test('FIX24: guest-cycle counter rollover remains monotonic',async()=>{
 let t=0;
 const pacer=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{t+=ms;}});
 pacer.reset(0xffffff00);
 await pacer.pace(0x00000100);
 assert.equal(pacer.stats().cycles,512);
});

test('FIX24: STOP interrupts any pending real-time wait',async()=>{
 let t=0;let running=true;
 const pacer=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{t+=ms;running=false;}});
 pacer.reset(0);
 await pacer.pace(50_000_000,()=>running);
 assert.ok(t<1000);
});
