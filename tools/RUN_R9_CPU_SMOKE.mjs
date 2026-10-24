#!/usr/bin/env node
/** Actual Musashi WASM instruction smoke, not adapter tests.
 * Requires compiled Emscripten core and executes a synthetic 68000 HU image
 * (MOVEQ, ADDQ.L, NOP, two intercepted Human68k DOS F-line traps).
 * Does NOT test PAN playback, graphics, sound or a complete Human68k OS.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const target = resolve(process.argv[2] ?? new URL('../core/pwp_musashi.mjs', import.meta.url).pathname);
function syntheticHU(){
  const code=Uint8Array.from([0x70,0x2a,0x52,0x80,0x4e,0x71,0xff,0x48,0xff,0x4c]);
  const image=new Uint8Array(64+code.length);
  const v=new DataView(image.buffer);
  image[0]=0x48;image[1]=0x55;  // HU
  v.setUint32(12,code.length,false); // text length big endian
  image.set(code,64);
  return image;
}
try {
  const createModule=(await import(pathToFileURL(target).href)).default;
  assert.equal(typeof createModule,'function','actual compiled Emscripten factory required');
  const wasm=await createModule();
  assert.ok(wasm.HEAPU8 instanceof Uint8Array,'WASM linear memory required');
  for(const sym of ['_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load','_pwp_mu_run',
    '_pwp_mu_dispatch','_pwp_mu_status','_pwp_mu_steps','_pwp_mu_pc','_pwp_mu_register',
    '_pwp_mu_trap','_pwp_mu_exit_code']) assert.equal(typeof wasm[sym],'function',sym);
  const hu=syntheticHU();
  const offset=wasm._pwp_mu_stage_ptr()>>>0;
  const capacity=wasm._pwp_mu_stage_capacity()>>>0;
  assert.ok(offset<=wasm.HEAPU8.byteLength && hu.byteLength<=capacity && hu.byteLength<=wasm.HEAPU8.byteLength-offset);
  wasm.HEAPU8.set(hu,offset);
  assert.equal(wasm._pwp_mu_load(hu.byteLength),1,'HU load failed');
  assert.equal(wasm._pwp_mu_pc()>>>0,0x10000,'HU entrypoint');
  assert.equal(wasm._pwp_mu_run(32),2,'first DOS trap');
  assert.equal(wasm._pwp_mu_trap()>>>0,0xff48,'must reach _MALLOC after actual instructions');
  assert.equal(wasm._pwp_mu_register(0)|0,43,'MOVEQ 42; ADDQ.L 1 required (not mock registers)');
  assert.equal(wasm._pwp_mu_steps()>>>0,3,'MOVEQ, ADDQ.L, NOP should execute');
  assert.equal(wasm._pwp_mu_dispatch(),1,'_MALLOC(0) handled');
  assert.equal(wasm._pwp_mu_register(0)|0,-8,'_MALLOC(0) error result');
  assert.equal(wasm._pwp_mu_run(32),2,'second DOS trap');
  assert.equal(wasm._pwp_mu_trap()>>>0,0xff4c,'must reach _EXIT2');
  assert.equal(wasm._pwp_mu_dispatch(),4,'process exits');
  assert.equal(wasm._pwp_mu_exit_code(),0,'exit code');
  process.stdout.write('PASS R9 REAL MUSASHI WASM CPU: MOVEQ/ADDQ/NOP, DOS _MALLOC, _EXIT2 (NOT PAN playback)\n');
} catch(e){
  process.stderr.write(`R9 REAL MUSASHI SMOKE FAIL: ${e?.stack??String(e)}\n`);
  process.exitCode=1;
}
