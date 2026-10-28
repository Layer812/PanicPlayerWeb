import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverLinkedAudio} from '../src/url-audio-recovery.mjs';

test('blocked URL audio: click activates audio, stops video, restarts PANIC.X from start',async()=>{
  const order=[];
  let running=false;
  await recoverLinkedAudio({
    unlock:()=>{order.push('audio-unlock');running=true;return Promise.resolve();},
    isRunning:()=>{order.push('audio-confirm');return running;},
    stopKeepingAudio:async()=>{order.push('stop-keep-audio');},
    restart:async()=>{order.push('restart-guest-from-beginning');}
  });
  assert.deepEqual(order,['audio-unlock','audio-confirm','stop-keep-audio','restart-guest-from-beginning']);
});
test('blocked URL audio: failed browser unlock never stops or restarts guest',async()=>{
 const order=[];
 await assert.rejects(()=>recoverLinkedAudio({
  unlock:async()=>order.push('unlock'),
  isRunning:()=>false,
  stopKeepingAudio:async()=>order.push('STOP-INVALID'),
  restart:async()=>order.push('RESTART-INVALID')
 }),/許可/);
 assert.deepEqual(order,['unlock']);
});
test('blocked URL audio: failed resume never restarts guest',async()=>{
 const order=[];
 await assert.rejects(()=>recoverLinkedAudio({
  unlock:()=>Promise.reject(new Error('blocked')),
  isRunning:()=>true,
  stopKeepingAudio:async()=>order.push('STOP-INVALID'),
  restart:async()=>order.push('RESTART-INVALID')
 }),/blocked/);
 assert.deepEqual(order,[]);
});
test('URL audio recovery is never applied to a missing lifecycle',async()=>{
 await assert.rejects(()=>recoverLinkedAudio({unlock:()=>{}}),TypeError);
});
