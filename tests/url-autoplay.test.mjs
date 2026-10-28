import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioOutput} from '../src/audio-output.js';
import {parsePanId,resolveGithubPanId} from '../src/pan-url.mjs';

test('PAN URL is the only eligible auto-start selector',()=>{
  assert.equal(parsePanId(''),null);
  assert.equal(parsePanId('?pan=denkofm'),'denkofm');
  for(const query of ['?pan=../evil','?pan=https:%2f%2fevil','?pan=a&pan=b'])
    assert.throws(()=>parsePanId(query));
  assert.equal(resolveGithubPanId([{source:'github',name:'denkofm.pan',sha:'a'.repeat(40),size:965232}],'denkofm').name,'denkofm.pan');
});

test('URL audio: allowed context starts automatically without extra buttons', async()=>{
  const original=globalThis.window;
  class Allowed {state='running';currentTime=0;resume(){return Promise.resolve();}}
  globalThis.window={AudioContext:Allowed};
  try {
    const output=new AudioOutput();
    assert.equal(await output.tryAutoplay(100),true);
    assert.equal(output.context.state,'running');
  } finally {globalThis.window=original;}
});

test('URL audio: blocked suspended context does not hang auto-video', async()=>{
  const original=globalThis.window;
  class Blocked {
    state='suspended';currentTime=0;
    resume(){return new Promise(()=>{});} // browser waits for a gesture
  }
  globalThis.window={AudioContext:Blocked};
  try {
    const output=new AudioOutput();
    const start=Date.now();
    assert.equal(await output.tryAutoplay(20),false);
    assert.ok(Date.now()-start<2000);
    assert.equal(output.context.state,'suspended');
  } finally {globalThis.window=original;}
});
