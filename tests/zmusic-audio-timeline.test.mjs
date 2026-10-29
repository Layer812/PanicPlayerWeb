import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioOutput} from '../src/audio-output.js';

test('YM2151 FM sample offsets respect shared guest-start audio timeline',async()=>{
 const old=globalThis.window;
 let currentTime=3;
 const starts=[];
 class Context {
   state='running'; destination={};
   get currentTime(){return currentTime;}
   createBuffer(channels,n,rate){return {getChannelData:()=>new Float32Array(n)}}
   createBufferSource(){return {connect(){},start:t=>starts.push(t),stop(){}};}
   async close(){this.state='closed'}
 }
 globalThis.window={AudioContext:Context};
 try {
  const a=new AudioOutput();
  await a.enable();
  a.beginGuestTimeline(); // guest t=0 -> context t=3.025
  currentTime=4.985;
  assert.equal(a.enqueue(new Float32Array(2*500),62500,2,'FM',2),true);
  assert.ok(Math.abs(starts[0]-5.025)<1e-7, String(starts[0]));
  // Same real guest timestamp schedules ADPCM and FM concurrently.
  assert.equal(a.enqueue(new Float32Array(2*100),15625,2,'default',2),true);
  assert.ok(Math.abs(starts[1]-5.025)<1e-7,String(starts[1]));
  assert.equal(a.sources.size,2);
  a.halt('default');
  assert.equal(a.sources.size,1);
  a.halt();
  assert.equal(a.guestAudioOrigin,null);
  await a.stop();
 }finally{globalThis.window=old;}
});
