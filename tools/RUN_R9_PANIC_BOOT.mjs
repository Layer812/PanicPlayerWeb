#!/usr/bin/env node
/** Real Musashi startup test of the original panic.x V1.38, NOT animation playback.
 * Usage: node RUN_R9_PANIC_BOOT.mjs /path/pwp_musashi.mjs /path/PANIC.X
 * No mocks. Fails if the first expected _SETBLOCK trap is not reached. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyPanicX} from '../src/hu-startup-probe.mjs';
try {
  if(process.argv.length!==4)throw new Error('Usage: node RUN_R9_PANIC_BOOT.mjs core/pwp_musashi.mjs PANIC.X');
  const [modulePath,huPath]=process.argv.slice(2).map(path => resolve(path));
  const hu=Uint8Array.from(fs.readFileSync(huPath));
  verifyPanicX(hu);
  const factory=(await import(pathToFileURL(modulePath).href)).default;
  const m=await factory();
  assert.ok(m.HEAPU8 instanceof Uint8Array);
  const ptr=m._pwp_mu_stage_ptr()>>>0;
  assert.ok(hu.length<=m._pwp_mu_stage_capacity());
  assert.ok(ptr<=m.HEAPU8.length && hu.length<=m.HEAPU8.length-ptr);
  m.HEAPU8.set(hu,ptr);
  assert.equal(m._pwp_mu_load(hu.length),1);
  // Human68k A2 points to length-prefixed LASCII command line.
  // Without it an authentic PANIC.X cannot discover P68K.PAN.
  assert.equal(typeof m._pwp_mu_guest_peek8,'function','R11 guest RAM probe required');
  const cmd = 'C:\\P68K.PAN';
  const a2 = m._pwp_mu_register(10) >>> 0; // D0..D7,A0,A1,A2
  assert.equal(a2,0x8000,'A2 must reference the prepared command line');
  assert.equal(m._pwp_mu_guest_peek8(a2),cmd.length,'LASCII byte length');
  for(let i=0;i<cmd.length;i++)
    assert.equal(m._pwp_mu_guest_peek8(a2+1+i),cmd.charCodeAt(i),`command tail byte ${i}`);
  assert.equal(m._pwp_mu_guest_peek8(a2+1+cmd.length),0,'LASCII NUL terminator');
  // Human68k A1 must point to the end of loaded text+data+BSS,
  // not the top of the initially claimed 4MiB process memory block.
  const programEnd=m._pwp_mu_bss_end()>>>0;
  assert.equal(m._pwp_mu_register(9)>>>0,programEnd,'Human68k A1 program end+1');
  assert.equal(programEnd,0x15366,'authentic PANIC.X V1.38 BSS end');
  assert.equal(m._pwp_mu_guest_peek32(0xfff8)>>>0,0x3f0000,'initial process MCB holds full memory');
  assert.equal(m._pwp_mu_run(24),2);
  assert.equal(m._pwp_mu_trap()>>>0,0xff4a,'expected first _SETBLOCK');
  assert.equal(m._pwp_mu_trap_pc()>>>0,0x10012,'expected FF4A at executable offset 0x12');
  assert.equal(m._pwp_mu_steps()>>>0,6,'six real instructions execute before intercepted FF4A');
  const status=m._pwp_mu_dispatch();
  assert.equal(status,1,'DOS _SETBLOCK must resume execution');
  assert.equal(m._pwp_mu_register(0)|0,0,'initial _SETBLOCK should succeed');
  assert.equal(m._pwp_mu_guest_peek32(0xfff8)>>>0,programEnd,
    'SETBLOCK must release the unused RAM tail before MALLOC');
  assert.equal(m._pwp_mu_run(100),2,'PANIC.X must reach its 256KiB _MALLOC');
  assert.equal(m._pwp_mu_trap()>>>0,0xff48,'PANIC.X next startup DOS call is _MALLOC');
  assert.equal(m._pwp_mu_trap_pc()>>>0,0x10020,'authentic startup _MALLOC PC');
  assert.equal(m._pwp_mu_dispatch(),1,'PANIC.X _MALLOC dispatch');
  const mallocD0=m._pwp_mu_register(0)|0;
  assert.ok(mallocD0>=programEnd && mallocD0<0x3f0000-0x40000,
    `real PANIC.X 256KiB workspace must succeed, got D0=${mallocD0}`);
  console.log(JSON.stringify({realMusashi:true,actualPanicX:true,
    firstDOS:'FF4A',mallocDOS:'FF48',mallocD0,programEnd,programMemoryReleased:true,instructions:m._pwp_mu_steps()>>>0,
    pc:m._pwp_mu_pc()>>>0,commandline:cmd,postDosState:status,d0:m._pwp_mu_register(0)|0},null,2));
  console.log('PASS R16 FIX2 REAL Musashi PANIC.X SETBLOCK + MALLOC 256KiB (NOT playback)');
} catch(e) {
  console.error('R9 PANIC.X BOOT FAILED:',e?.stack??String(e));
  process.exitCode=1;
}
