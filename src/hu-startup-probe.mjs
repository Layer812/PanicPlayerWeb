// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** Development-only PANIC.X boot probe. NOT a playback engine. */
const EXPECTED_SIZE = 15412;
const FIRST_CODE = Uint8Array.from([
  0x4d,0xfa,0x3b,0xf2,0x4f,0xfa,0x53,0x60,0x41,0xe8,0x00,0x10,
  0x93,0xc8,0x2f,0x09,0x2f,0x08,0xff,0x4a
]);
const hex = (n,width=8)=>`0x${n.toString(16).toUpperCase().padStart(width,'0')}`;

export function verifyPanicX(data){
  if (!(data instanceof Uint8Array)) throw new TypeError('PANIC.X bytes must be Uint8Array');
  if (data.byteLength !== EXPECTED_SIZE) throw new Error(`Expected exactly ${EXPECTED_SIZE} bytes of PANIC.X V1.38`);
  if (data[0]!==0x48 || data[1]!==0x55) throw new Error('Invalid HU executable header');
  const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(dv.getUint32(12,false)!==0x39a2 || dv.getUint32(16,false)!==0x252 || dv.getUint32(20,false)!==0x1772 || dv.getUint32(24,false)!==0){
    throw new Error('Unexpected PANIC.X V1.38 memory layout');
  }
  for(let i=0;i<FIRST_CODE.length;i++) if(data[64+i]!==FIRST_CODE[i])
    throw new Error(`Unexpected executable startup instruction at code offset ${i}`);
  return true;
}

export async function runStartupProbe(data, wasmSource) {
  verifyPanicX(data);
  const obj = await WebAssembly.instantiate(wasmSource, {});
  const e = obj.instance?.exports ?? obj.exports;
  if(!e?.memory || !e?.pwp_hu_stage_ptr || !e?.pwp_hu_load || !e?.pwp_hu_run){
    throw new Error('R3 WASM startup module is incomplete');
  }
  const ptr = e.pwp_hu_stage_ptr();
  if (data.byteLength > e.pwp_hu_stage_capacity()) throw new Error('Staging buffer exceeded');
  new Uint8Array(e.memory.buffer,ptr,data.byteLength).set(data);
  const loaded = e.pwp_hu_load(data.length);
  if(loaded!==1) throw new Error(`HU loader rejected executable: status ${loaded}`);
  const state = e.pwp_hu_run(50);
  return {
    success: state===2 && e.pwp_hu_trap_opcode()===0xff4a && e.pwp_hu_steps()===7,
    state,
    instructionCount:e.pwp_hu_steps(),
    trap:hex(e.pwp_hu_trap_opcode(),4),
    trapPC:hex(e.pwp_hu_fault_pc()),
    pc:hex(e.pwp_hu_pc()),
    codeStart:hex(0x10000),
    textAndDataEnd:hex(e.pwp_hu_image_end()),
    bssEnd:hex(e.pwp_hu_bss_end()),
    a6:hex(e.pwp_hu_register(14)),
    a7:hex(e.pwp_hu_register(15)),
    message: state===2?'Reached first DOS F-line trap; no DOS service was executed.':'Did not reach expected DOS startup trap.'
  };
}
