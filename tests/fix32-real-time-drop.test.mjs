import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGuestClockLimiter} from '../src/guest-clock.mjs';
import {shouldPresentScanout} from '../src/panic-core.mjs';

test('FIX32: a clamped 4ms browser timer cannot force thousands of reanchors',async()=>{
 let t=0;let requests=[];
 const p=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{requests.push(ms); t+=Math.max(4,ms);},cpuHz:16_000_000});
 p.reset();
 // 400 microbatches, 0.16ms guest per batch, 64ms virtual total
 for(let i=1;i<=400;i++){t+=0.001;await p.pace(i*2560)}
 assert.equal(p.stats().resyncs,0);
 assert.ok(requests.length<25,`unnecessary host sleeps: ${requests.length}`);
 assert.ok(requests.every(ms=>ms>=6),`sub-clamp timer issued: ${requests}`);
 assert.ok(t>=55 && t<=72,`virtual=64ms actual=${t}`);
 assert.equal(p.stats().cycles,1024000);
});

test('FIX32: once late, continue executing guest cycles without wall-time reset',async()=>{
 let t=0;let sleeps=0;
 const p=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{sleeps++;t+=ms;},cpuHz:16_000_000});
 p.reset(); t=100;
 for(let i=1;i<=100;i++) await p.pace(i*16_000); // 100ms virtual
 assert.equal(p.stats().realWallMs,100);
 assert.equal(p.stats().virtualMs,100);
 assert.equal(sleeps,0);
 assert.equal(p.stats().resyncs,0);
 assert.ok(p.stats().peakLateMs>0);
});

test('FIX32: presentation gate only drops late scanouts, not the first or sparse updates',()=>{
 assert.equal(shouldPresentScanout({lateMs:0,firstVisible:true,msSincePaint:1}),true);
 assert.equal(shouldPresentScanout({lateMs:18,firstVisible:true,msSincePaint:25}),false);
 assert.equal(shouldPresentScanout({lateMs:18,firstVisible:false,msSincePaint:1}),true);
 assert.equal(shouldPresentScanout({lateMs:100,firstVisible:true,msSincePaint:260}),true);
});

test('FIX32: external file I/O can rebase its own pause without frame-by-frame reset',async()=>{
 let t=0; const p=makeGuestClockLimiter({now:()=>t,sleep:async ms=>{t+=ms;},cpuHz:16_000_000});
 p.reset();t=1000;p.resume();
 await p.pace(160_000);
 assert.ok(p.stats().lateMs<0.1);
 assert.equal(p.stats().realWallMs>=1000,true);
});
