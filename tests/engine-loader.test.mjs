import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEngine} from '../src/engine-loader.js';
test('R2 never claims playback capability with missing WASM core',async()=>{
 const result=await loadEngine({});
 assert.equal(result.engine,null);
 assert.match(result.reason,/未接続/);
});
