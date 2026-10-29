#!/usr/bin/env node
/** Public-browser module + private real Musashi WASM acceptance test.
 * Uses upstream-pinned *real* ZMUSIC208.X, never redistributes its bytes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {webcrypto} from 'node:crypto';
import {verifyZmusic208,bootRealZmusic208} from '../src/zmusic-resident.mjs';
const wasmPath=resolve(process.argv[2]);
const driver=new Uint8Array(readFileSync(resolve(process.argv[3])));
await verifyZmusic208(driver,webcrypto.subtle);
const factory=(await import(pathToFileURL(wasmPath).href)).default;
async function makeGuest(hu){
  const m=await factory();
  const ptr=m._pwp_mu_stage_ptr()>>>0;
  m.HEAPU8.set(hu,ptr);
  assert.equal(m._pwp_mu_load(hu.length),1,'PANIC HU must load before ZMUSIC');
  return m;
}
async function bootGuest(hu){
  const m=await makeGuest(hu);
  const expected=m._pwp_mu_pc()>>>0;
  const result=await bootRealZmusic208(m,driver,{yieldControl:async()=>{}});
  assert.ok(result.services>=40,'authentic driver must execute full startup');
  assert.ok(result.steps>=1000,'actual guest CPU instructions executed');
  assert.equal(result.guestPC,expected,'PANIC.X CPU restored after real _KEEPPR');
  assert.equal(m._pwp_mu_tsr_phase(),2,'the real guest became resident');
  assert.equal(result.handler,m._pwp_mu_guest_peek32(0x8c)>>>0,'real trap #3 vector');
  return m;
}
// Check real driver TRAP #3 with a tiny separate PANIC-side client.
const fake=new Uint8Array(72);fake[0]=0x48;fake[1]=0x55;
new DataView(fake.buffer).setUint32(12,8,false);
fake.set([0x72,0x50,0x4e,0x43,0xff,0x4c,0x4e,0x71],64);
const m=await bootGuest(fake);
assert.equal(m._pwp_mu_run(512),2,'guest TRAP #3 status call must return to client');
assert.equal(m._pwp_mu_trap()>>>0,0xff4c,'real handler returns to guest DOS exit');
const statusPtr=m._pwp_mu_register(8)>>>0;
assert.ok(statusPtr>=0x240000 && statusPtr<0x3c0000,
  'real Z-MUSIC returns a status pointer in retained guest RAM');
assert.equal(m._pwp_mu_dispatch(),4);
console.log('PASS browser Z-MUSIC bridge: REAL HU driver _KEEPPR + guest TRAP #3 status');
// Now use the actual pinned PANIC.X, not an injected synthetic guest client.
if(process.argv[4]){
  const panic=new Uint8Array(readFileSync(resolve(process.argv[4])));
  const n=await bootGuest(panic);
  const current=n._pwp_mu_run(512);
  assert.ok([1,2,3].includes(current),
    'original PANIC.X must still execute after genuine Z-MUSIC residency: '+current);
  assert.equal(n._pwp_mu_tsr_phase(),2);
  console.log('PASS actual PANIC.X CPU boots AFTER ZMUSIC208.X _KEEPPR');
}
