#!/usr/bin/env node
/** Execute a *real* synthetic HU resident program on pinned Musashi WASM.
 * The synthetic program installs its own handler and calls DOS _KEEPPR.
 * This is NOT ZMUSIC208.X and does NOT prove that driver plays music.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const target=resolve(process.argv[2]??'core/pwp_musashi.mjs');
const create=(await import(pathToFileURL(target).href)).default;
const m=await create();
const stage=m._pwp_mu_stage_ptr()>>>0;
const put=(bytes)=>{
  assert.ok(bytes.length <= m._pwp_mu_stage_capacity()>>>0);
  m.HEAPU8.set(bytes,stage);
};
const makeHU=(code)=>{
  const file=new Uint8Array(64+code.length);
  file[0]=0x48;file[1]=0x55;
  new DataView(file.buffer).setUint32(12,code.length,false);
  file.set(code,64);
  return file;
};
for(const fn of ['_pwp_mu_tsr_begin','_pwp_mu_tsr_phase','_pwp_mu_tsr_steps',
 '_pwp_mu_load','_pwp_mu_run','_pwp_mu_dispatch','_pwp_mu_guest_peek32'])
 assert.equal(typeof m[fn],'function',fn);
const guest=makeHU(Uint8Array.from([0x70,0x2a,0xff,0x4c]));
put(guest);
assert.equal(m._pwp_mu_load(guest.length),1);
assert.equal(m._pwp_mu_pc()>>>0,0x10000);

const code=new Uint8Array(160);
code.set([
  0x22,0x3c,0,0x08,0x76,0x70,         // MOVE.L #$00087670,D1 (16x16 font)
  0x22,0x7c,0,0x24,0,0x80,            // MOVEA.L #$240080,A1 (font buffer)
  0x70,0x19,                           // MOVEQ #$19,D0: IOCS _FNTGET
  0x4e,0x4f,                           // Actual TRAP #15
  0x72,0x23,                           // MOVEQ #35,D1 (TRAP #3 vector index)
  0x22,0x7c,0,0x24,0,0x40,            // MOVEA.L #$240040,A1
  0x70,0x80,                           // MOVEQ #$80,D0: IOCS _B_INTVCS
  0x4e,0x4f,                           // Actual TRAP #15
  0x42,0x67,                           // CLR.W -(SP) : _KEEPPR exit code
  0x2f,0x3c,0,0,0,0xa0,                // MOVE.L #160,-(SP): length to remain
  0xff,0x31                            // Human68k DOS _KEEPPR
],0);
code.set(new TextEncoder().encode('ZmuSiC'),0x38);
code[0x3e]=0x20;code[0x3f]=0x80;
code.set([0x4e,0x73],0x40);           // Real RTE at registered handler
const driver=makeHU(code);
put(driver);
assert.equal(m._pwp_mu_tsr_begin(driver.length),1);
assert.equal(m._pwp_mu_tsr_phase(),1);
assert.equal(m._pwp_mu_guest_peek32(0x88)>>>0,0xff0000,'PCM8 absent: IPL ROM vector');
assert.equal(m._pwp_mu_guest_peek32(0x8c)>>>0,0xff0000,'Z-MUSIC absent: IPL ROM vector');
assert.equal(m._pwp_mu_guest_peek32(0x228)>>>0,0xff0000,'unclaimed MIDI IRQ is ROM-managed');
assert.equal(m._pwp_mu_guest_peek32(0x1a8)>>>0,0xff0000,'unclaimed ADPCM IRQ is ROM-managed');
assert.equal(m._pwp_mu_guest_peek32(0x6810)>>>0,0xffffffff,'real NUL end-of-device-chain');
assert.equal(m._pwp_mu_guest_peek32(0x6814)>>>16,0x8024,'real NUL device attributes');
assert.equal(m._pwp_mu_pc()>>>0,0x240000);
assert.equal(m._pwp_mu_run(200),2,'real guest must reach IOCS _FNTGET');
assert.equal(m._pwp_mu_trap()>>>0,0x4e4f);
assert.equal(m._pwp_mu_register(0)&255,0x19);
assert.equal(m._pwp_mu_dispatch(),1,'real gaiji font read accepted');
assert.equal(m._pwp_mu_guest_peek32(0x240080)>>>0,0x00100010,
  '16x16 character geometry written in authentic IOCS buffer');
assert.equal(m._pwp_mu_guest_peek32(0x240084)>>>0,0,
  'untouched gaiji bitmap remains blank');
assert.equal(m._pwp_mu_run(200),2,'real guest must reach IOCS _B_INTVCS');
assert.equal(m._pwp_mu_trap()>>>0,0x4e4f);
assert.equal(m._pwp_mu_register(1)>>>0,35);
assert.equal(m._pwp_mu_dispatch(),1,'actual guest vector install accepted');
assert.equal(m._pwp_mu_guest_peek32(0x8c)>>>0,0x240040);
assert.equal(m._pwp_mu_run(200),2,'real guest must reach DOS _KEEPPR');
assert.equal(m._pwp_mu_trap()>>>0,0xff31);
assert.equal(m._pwp_mu_dispatch(),1,'real _KEEPPR must restore PANIC CPU');
assert.equal(m._pwp_mu_tsr_phase(),2,'actual guest resident signature and handler verified');
assert.ok(m._pwp_mu_tsr_steps()>=4,'real guest 68000 instructions were executed');
assert.equal(m._pwp_mu_pc()>>>0,0x10000,'PANIC guest PC restored');
assert.equal(m._pwp_mu_guest_peek32(0x8c)>>>0,0x240040,'real trap vector persisted');
assert.equal(m._pwp_mu_run(100),2,'original guest continues independently');
assert.equal(m._pwp_mu_trap()>>>0,0xff4c);
assert.equal(m._pwp_mu_register(0)>>>0,42);
assert.equal(m._pwp_mu_dispatch(),4);
console.log('PASS real pinned Musashi WASM: separate HU guest, genuine _B_INTVCS, _KEEPPR, CPU restore, PANIC resumed. Synthetic fixture ONLY.');
