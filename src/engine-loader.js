// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/*
  The core plugin is intentionally absent from R1.
  Future src/panic-core.mjs contract:
    export async function createPanicEngine({readPan, videoFrame, audioFrames, finished, error})
  It must return { load({id, name, size}), start(), stop(), space(), dispose() }.
  `readPan(id, offset, size)` returns Promise<Uint8Array>; callbacks get decoded frames/PCM.
  Do NOT report runtime ready without these methods.
*/
const REQUIRED = ['load', 'start', 'stop', 'space', 'dispose'];
export async function loadEngine(host) {
  let module;
  try {
    // Core is optional. This path must be supplied by the actual WASM port.
    module = await import('./panic-core.mjs');
  } catch (e) {
    // Missing core is a development state, not a claim of functional playback.
    if (e?.code === 'ERR_MODULE_NOT_FOUND' || /Failed to fetch dynamically imported module|Cannot find module/i.test(e?.message ?? '')) {
      return {engine: null, reason: 'PANIC再生コア（WebAssembly）が未接続です。'};
    }
    return {engine: null, reason: `再生コア読み込みエラー: ${e?.message ?? String(e)}`};
  }
  try {
    if (typeof module.createPanicEngine !== 'function') throw new Error('createPanicEngine not exported');
    const engine = await module.createPanicEngine(host);
    if (!engine || REQUIRED.some(method => typeof engine[method] !== 'function')) {
      throw new Error('PANIC engine interface incomplete');
    }
    return {engine, reason: null};
  } catch (e) {
    return {engine: null, reason: `再生コア初期化エラー: ${e?.message ?? String(e)}`};
  }
}
