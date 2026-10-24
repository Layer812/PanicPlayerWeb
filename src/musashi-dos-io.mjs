// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** PANIC.X guest read-only HostFS bridge. Only the selected Blob is readable.
 * This module does not play PAN; it services bounded _READ requests. */
const MAX_SAFE_BLOB = Number.MAX_SAFE_INTEGER;
export function mountPanBlob(wasm, blob) {
  if (!blob || !Number.isSafeInteger(blob.size) || blob.size<0 || blob.size>MAX_SAFE_BLOB || typeof blob.slice!=='function') {
    throw new TypeError('Expected Blob/File with a safe integer byte length');
  }
  if (wasm._pwp_mu_status()!==1) throw new Error('HU must be loaded before mounting PAN');
  const size=BigInt(blob.size);
  wasm._pwp_mu_set_pan_size(Number((size>>32n)&0xffffffffn), Number(size&0xffffffffn));
  return {size:blob.size};
}
/** Resolves one status-3 read. May require repeated calls for >64 KiB DOS reads.
 * Only valid after a genuine module has returned a DOS pending-read state. */
export async function servicePanRead(wasm, blob){
  if (wasm._pwp_mu_status()!==3) throw new Error('No pending DOS _READ request');
  const high=wasm._pwp_mu_io_offset_high()>>>0;
  const low=wasm._pwp_mu_io_offset_low()>>>0;
  const offset=high*4294967296+low;
  const count=wasm._pwp_mu_io_length()>>>0;
  const capacity=wasm._pwp_mu_io_capacity()>>>0;
  if(!Number.isSafeInteger(offset) || !count || count>capacity || count>65536 || offset>blob.size || offset+count>blob.size){
    throw new RangeError('Invalid, out-of-bounds, or non-bounded guest file request');
  }
  const bytes=new Uint8Array(await blob.slice(offset,offset+count).arrayBuffer());
  if (bytes.byteLength>count) throw new Error('Host read exceeded guest request');
  const ptr=wasm._pwp_mu_io_stage_ptr()>>>0;
  if (ptr+bytes.byteLength>wasm.HEAPU8.byteLength) throw new RangeError('WASM file staging memory overflow');
  wasm.HEAPU8.set(bytes,ptr);
  const state=wasm._pwp_mu_supply_read(bytes.byteLength);
  if (state!==1 && state!==3) throw new Error(`DOS transfer failed (state ${state})`);
  return {state,read:bytes.byteLength,offset};
}
