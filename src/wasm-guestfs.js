// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* Host<->WASM integration for C guestfs; actual PANIC 68000 guest isn't here yet.
 * Intended only for Dedicated Worker: uses sync file reads from WorkerPanFile.
 */
import {openPanWorkerFile} from './worker-pan-file.js';
const WASM_PATH = new URL('../core/pwp_guestfs.wasm', import.meta.url);
export async function createWasmGuestFile(file, options={}) {
  const source = openPanWorkerFile(file, options.FileReaderSync);
  let instance;
  // WASM owns its linear memory; import receives guest address, validates it.
  const imports = {pwp:{read_file(offset, address, count) {
    try {
      if (!instance || !Number.isInteger(address) || address < 0 || !Number.isInteger(count) || count < 0) return -1;
      const memory = instance.exports.memory.buffer;
      if (address > memory.byteLength || count > memory.byteLength - address) return -1;
      const data = source.read(offset, count);
      new Uint8Array(memory, address, data.length).set(data);
      return data.length;
    } catch (_e) { return -1; }
  }}};
  const bytes = options.wasmBytes ?? new Uint8Array(await (await fetch(WASM_PATH)).arrayBuffer());
  const compiled = await WebAssembly.instantiate(bytes, imports);
  instance = compiled.instance ?? compiled;
  const e = instance.exports;
  if (typeof e.pwp_mount !== 'function' || typeof e.pwp_read !== 'function' ||
      typeof e.pwp_seek !== 'function' || !e.memory) throw new Error('GuestFS WASM exports incomplete');
  if (e.pwp_mount(BigInt(source.size)) !== 1) throw new Error('Cannot mount selected PAN');
  const pointer = Number(options.pointer ?? 4096);
  const space = e.memory.buffer.byteLength;
  if (!Number.isSafeInteger(pointer) || pointer < 0 || pointer + 65536 > space) throw new Error('WASM scratch space invalid');
  return {
    size: source.size,
    readAt(offset, length) {
      if (!Number.isInteger(length) || length < 0 || length > 65536) throw new RangeError('WASM bridge read limit is 64 KiB');
      if ((typeof offset !== 'bigint' && (!Number.isSafeInteger(offset) || offset < 0)) ||
          (typeof offset === 'bigint' && offset < 0n)) throw new RangeError('Invalid WASM bridge offset');
      if (!e.pwp_seek(BigInt(offset))) throw new Error('WASM seek failed');
      const n=e.pwp_read(pointer, length);
      if (n < 0) throw new Error('WASM file read failed');
      return new Uint8Array(e.memory.buffer, pointer, n).slice();
    },
    close(){e.pwp_unmount();},
    wasm: e
  };
}
