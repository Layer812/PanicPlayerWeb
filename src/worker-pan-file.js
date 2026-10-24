// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
// Worker-only backing store. No full-file buffering and no network I/O.
// FileReaderSync is supported in Dedicated Workers, not on the main thread.
export const MAX_IO = 2 * 1024 * 1024;
const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
function exactOffset(value) {
  if (typeof value !== 'bigint' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('Invalid file offset');
  }
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n || n > SAFE) throw new RangeError('File offset exceeds JS safe integer');
  return Number(n);
}
export class WorkerPanFile {
  constructor(file, reader) {
    if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.slice !== 'function') {
      throw new TypeError('Expected a Blob/File with a safe size');
    }
    if (!reader || typeof reader.readAsArrayBuffer !== 'function') {
      throw new TypeError('FileReaderSync required (Dedicated Worker only)');
    }
    this.file = file;
    this.reader = reader;
    this.size = file.size;
  }
  read(offset, length) {
    const start = exactOffset(offset);
    if (!Number.isInteger(length) || length < 0 || length > MAX_IO) {
      throw new RangeError('Invalid read length');
    }
    if (start >= this.size || length === 0) return new Uint8Array(0);
    const end = Math.min(this.size, start + length);
    const data = this.reader.readAsArrayBuffer(this.file.slice(start, end));
    if (!(data instanceof ArrayBuffer) || data.byteLength !== end - start) throw new Error('FileReaderSync short/inconsistent read');
    return new Uint8Array(data);
  }
}
export function openPanWorkerFile(file, Reader = globalThis.FileReaderSync) {
  if (typeof Reader !== 'function') throw new Error('Browser does not provide FileReaderSync in Worker');
  return new WorkerPanFile(file, new Reader());
}
