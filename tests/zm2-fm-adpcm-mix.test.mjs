import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioOutput} from '../src/audio-output.js';

// FM and ADPCM are separate sound devices at one guest instant.
// Verify browser PCM streams overlap rather than queueing serially.
test('concurrent FM/ADPCM schedules overlap; ADPCM stop leaves FM alive',async()=>{
  const previous=globalThis.window;
  const starts=[],stops=[];
  class Context {
    state='running';currentTime=5;destination={};
    createBuffer(channels,n,rate){
      assert.equal(channels,2);
      assert.ok([62500,15625].includes(rate));
      return {getChannelData:()=>new Float32Array(n)};
    }
    createBufferSource(){
      let seq=starts.length;
      return {connect:()=>{},start:t=>starts.push({seq,t}),stop:()=>stops.push(seq)};
    }
    async close(){this.state='closed';}
  }
  globalThis.window={AudioContext:Context};
  try {
    const a=new AudioOutput();
    await a.enable();
    assert.equal(a.enqueue(new Float32Array(2*100),15625,2,'default'),true);
    assert.equal(a.enqueue(new Float32Array(2*400),62500,2,'FM'),true);
    assert.equal(starts.length,2);
    assert.equal(starts[0].t,starts[1].t,
      'FM and ADPCM from same guest time must be mixed, not serialized');
    a.halt('default');
    assert.deepEqual(stops,[0]);
    assert.equal(a.sources.size,1,'FM source must remain scheduled');
    a.halt();
    assert.deepEqual(stops,[0,1]);
    await a.stop();
  } finally {globalThis.window=previous;}
});
