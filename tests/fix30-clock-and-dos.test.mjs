import test from 'node:test';
import assert from 'node:assert/strict';
import {preferFastPaintYield} from '../src/panic-core.mjs';
import {makeGuestClockLimiter} from '../src/guest-clock.mjs';

test('FIX30: CPU below 95% target uses event-loop yield rather than extra rAF wait',()=>{
 assert.equal(preferFastPaintYield(5.12,10),true);
 assert.equal(preferFastPaintYield(9.0,10),true);
 assert.equal(preferFastPaintYield(9.5,10),false);
 assert.equal(preferFastPaintYield(10,10),false);
 assert.equal(preferFastPaintYield(0,10),false);
});
test('FIX32: lifetime wall-clock stays anchored during lateness',async()=>{
 let t=0;
 const pace=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{t+=ms;},cpuHz:10_000_000});
 pace.reset(0);
 t=120;
 await pace.pace(100_000); // guest:10ms, real:120ms
 assert.equal(pace.stats().resyncs,0);
 assert.equal(pace.stats().realWallMs,120);
 assert.equal(pace.stats().virtualMs,10);
 assert.ok(pace.stats().lateMs>100);
 assert.ok(pace.stats().wallMs>=120); // clock stays tied to actual wall elapsed time
});
