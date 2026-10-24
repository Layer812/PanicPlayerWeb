import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioOutput} from '../src/audio-output.js';

test('audio output queues exact stereo samples and halt stops sources',async()=>{
  const prev=globalThis.window;
  const starts=[], stops=[];
  class Context {
    state='running'; currentTime=10;destination={};
    createBuffer(channels,n,rate){
      assert.equal(channels,2); assert.equal(n,3);assert.equal(rate,15625);
      const data=[new Float32Array(n),new Float32Array(n)];
      return {getChannelData:i=>data[i],data};
    }
    createBufferSource(){return {buffer:null,connect:()=>{},start:t=>starts.push(t),stop:()=>stops.push(1)};}
    async close(){this.state='closed';}
  }
  globalThis.window={AudioContext:Context};
  try{
    const a=new AudioOutput();await a.enable();
    assert.equal(a.enqueue(new Float32Array([.1,.2,.3,.4,.5,.6]),15625,2),true);
    assert.equal(starts.length,1);assert.ok(starts[0]>10);
    assert.equal(a.sources.size,1);
    a.halt();assert.equal(stops.length,1);assert.equal(a.sources.size,0);
    await a.stop();assert.equal(a.context,null);
  }finally{globalThis.window=prev;}
});
