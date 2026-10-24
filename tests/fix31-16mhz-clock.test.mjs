import test from 'node:test';
import assert from 'node:assert/strict';
import {EMULATED_68000_HZ,makeGuestClockLimiter} from '../src/guest-clock.mjs';
import {preferFastPaintYield} from '../src/panic-core.mjs';

test('FIX31: configured guest 68000 speed is 16MHz, not an audio/presentation multiplier',async()=>{
 assert.equal(EMULATED_68000_HZ,16_000_000);
 let elapsed=0;let slept=0;
 const limiter=makeGuestClockLimiter({now:()=>elapsed,sleep:async ms=>{elapsed+=ms;slept+=ms;},maxAheadMs:0});
 limiter.reset(0);
 await limiter.pace(160_000); // 10ms at exactly 16MHz
 assert.equal(limiter.stats().virtualMs,10);
 assert.ok(elapsed>=9.999 && elapsed<=10.001,`elapsed ${elapsed}`);
 assert.ok(slept>=9.999);
 await limiter.pace(320_000); // 20ms total
 assert.equal(limiter.stats().virtualMs,20);
 assert.ok(elapsed>=19.999 && elapsed<=20.001);
});
test('FIX31: 10MHz historical limiter still has its own test reference',async()=>{
 let elapsed=0;
 const limiter=makeGuestClockLimiter({now:()=>elapsed,sleep:async ms=>{elapsed+=ms;},cpuHz:10_000_000,maxAheadMs:0});
 limiter.reset(0);await limiter.pace(100_000);
 assert.equal(limiter.stats().virtualMs,10);
});
test('FIX31: paint-yield threshold follows the new 16MHz target',()=>{
 assert.equal(preferFastPaintYield(14),true);
 assert.equal(preferFastPaintYield(15.19),true);
 assert.equal(preferFastPaintYield(15.2),false);
 assert.equal(preferFastPaintYield(16),false);
});
