// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** Panic Player Web R10: genuine Musashi-to-browser execution bridge.
 * This uses the real pwp_musashi.mjs when it exists. No simulator, demo
 * frames, prerecorded media or automatic stand-in on missing dependencies.
 * IMPORTANT: current X68000 hardware model is incomplete. This is an
 * experimental execution path, not a claim that PAN playback works yet.
 */
import {verifyPanicX} from './hu-startup-probe.mjs';
import {makeGuestClockLimiter, EMULATED_68000_HZ} from './guest-clock.mjs';
import {matchMissingPalette0} from './pan-palette-evidence.mjs';
import {decodeGuestADPCMChain} from './adpcm-msm6258.mjs';

const REQUIRED = [
 '_pwp_mu_stage_ptr','_pwp_mu_stage_capacity','_pwp_mu_load',
 '_pwp_mu_set_pan_size','_pwp_mu_run','_pwp_mu_status',
 '_pwp_mu_register','_pwp_mu_guest_peek8',
 '_pwp_mu_dispatch','_pwp_mu_trap','_pwp_mu_trap_pc',
 '_pwp_mu_io_stage_ptr','_pwp_mu_io_capacity','_pwp_mu_io_offset_high',
 '_pwp_mu_io_offset_low','_pwp_mu_io_length','_pwp_mu_supply_read',
 '_pwp_mu_iocs_crt_mode','_pwp_mu_video_vctrl_r2','_pwp_mu_video_vctrl_r1', '_pwp_mu_video_write_count','_pwp_mu_video_pixel_writes','_pwp_mu_video_crtc_changes','_pwp_frame_render','_pwp_frame_pointer',
 '_pwp_frame_size','_pwp_frame_render_mode10'
];
export const PANIC_X_V138_SHA256 = 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd';
const IO_MAX = 65536;
// Verified Human68k process command tail: length-prefixed LASCII at guest A2.
// Only the isolated, read-only DOS virtual file may be named here.
const PANIC_GUEST_COMMAND = 'C:\\P68K.PAN';
const COMMAND_ADDR = 0x8000;
const MAX_SIZE = BigInt(Number.MAX_SAFE_INTEGER);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
// Do not run another guest CPU slice before the browser has had a chance to
// composite the frame just submitted to Canvas. requestAnimationFrame alone
// is insufficient: promise microtasks resumed in the rAF callback can update
// the canvas again BEFORE the same display refresh is painted. Move CPU work
// into a subsequent task, after the rAF rendering opportunity.
// FIX32: sample only at true guest scanout boundaries; when behind the
// real-time deadline, omit old Canvas presentations (not guest work).
// Allow an occasional UI refresh under sustained overload, so the browser
// does not appear frozen.
export const shouldPresentScanout = ({lateMs,firstVisible,msSincePaint,
  frameMs=1000/60,maxSilenceMs=250}) =>
  !firstVisible || !Number.isFinite(lateMs) || lateMs < frameMs || msSincePaint>=maxSilenceMs;
export const preferFastPaintYield = (measuredMHz, targetMHz=EMULATED_68000_HZ/1_000_000) =>
  Number.isFinite(measuredMHz) && measuredMHz > 0 && measuredMHz < targetMHz*0.95;
export const waitForBrowserPaint = () => new Promise(resolve => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => setTimeout(resolve, 0));
  } else {
    // Node/host tests, which have no browser renderer.
    setTimeout(resolve, 1);
  }
});
const hex = (n) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`;

function validHeap(m, ptr, length) {
  if (!Number.isSafeInteger(ptr) || !Number.isSafeInteger(length) ||
      ptr < 0 || length < 0 || ptr > m.HEAPU8.byteLength ||
      length > m.HEAPU8.byteLength - ptr) {
    throw new RangeError(`Out-of-range WASM buffer: offset=${ptr} count=${length}`);
  }
}

export async function checkPanicSha256(hu, subtle = globalThis.crypto?.subtle) {
  verifyPanicX(hu);
  if (!subtle?.digest) throw new Error('SHA-256 validation is unavailable');
  const hash = Array.from(new Uint8Array(await subtle.digest('SHA-256', hu)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== PANIC_X_V138_SHA256)
    throw new Error(`PANIC.X SHA-256 mismatch: ${hash}`);
  return true;
}

export function createMusashiBridge(m, host, hu) {
  if (!(m?.HEAPU8 instanceof Uint8Array)) throw new Error('Actual WASM heap unavailable');
  for (const name of REQUIRED) if (typeof m[name] !== 'function') {
    throw new Error(`Actual Musashi WASM missing ${name}`);
  }
  verifyPanicX(hu);
  // Refuse a mixed FIX22 CPU (falling-edge only) with a FIX23 display bridge.
  // Older isolated JS fixtures without a raster clock are still exercised
  // by the legacy unit tests; the actual WASM must export both counters.
  if (typeof m._pwp_mu_vdisp_ticks === 'function' &&
      typeof m._pwp_mu_scanout_ticks !== 'function')
    throw new Error('FIX23 requires the rebuilt start-of-scanout Musashi WASM');
  let active = false;
  let selected = null;
  let running = null;
  let stopped = false;
  let lastWrites = 0;
  let lastR1 = 0, lastR2 = 0, lastCrtcChanges = 0;
  let firstPaint = false;
  let firstVisiblePaint = false;
  let firstFrameNumber = 0;
  let lastFramePixels = null;
  let completedPaints = 0;
  let session = 0;
  // FIX23: sample after virtual VBlank (start of the next active scan),
  // not at arbitrary 6,000-instruction slices. Avoid showing half-drawn
  // frames that disappear before the physical display would scan them out.
  // Pace every actual 68000 execution-cycle slice to wall clock. This does NOT
  // fabricate frames or alter Musashi/video register state.
  let lastSampledScanout = null;
  let paletteEvidenceRecords=[];
  let paletteEvidenceStatus='照合対象なし';
  let paletteEvidenceColor=0;
  let paletteEvidenceOffset=-1;
  const setPaletteEvidence=(enabled,word,offset,status)=>{
    if(typeof m._pwp_frame_set_palette0_evidence!=='function')
      throw new Error('FIX27 requires rebuilt Musashi WASM with palette evidence export');
    const nextWord=enabled?(word&0xffff):0;
    const nextOffset=enabled?offset:-1;
    if(paletteEvidenceColor!==nextWord || paletteEvidenceOffset!==nextOffset ||
       paletteEvidenceStatus!==status){
      m._pwp_frame_set_palette0_evidence(enabled?1:0,nextWord);
      paletteEvidenceColor=nextWord;paletteEvidenceOffset=nextOffset;
      paletteEvidenceStatus=status;
      host.paletteEvidence?.({status,color:enabled?nextWord:null,offset:nextOffset,
        guestG0:typeof m._pwp_mu_video_palette_word==='function'?m._pwp_mu_video_palette_word(0,0):null});
    }
  };
  // FIX24: throttle actual guest 68000 cycles, not just 60Hz video outputs.
  const guestCycleClock = typeof m._pwp_mu_guest_cycles === 'function'
    ? makeGuestClockLimiter({cpuHz:EMULATED_68000_HZ}) : null;
  if (typeof m._pwp_mu_scanout_ticks === 'function' && !guestCycleClock)
    throw new Error('FIX24 requires real guest-cycle export from Musashi WASM');
  let meterWall=0, meterCycles=0, measuredMHz=0, lastTelemetryWall=0;
  // Timing work counters, collected in the NORMAL player (no special
  // diagnostic build). CPU time and host waits never add to guest cycles.
  let profileCpuMs=0, profilePaceMs=0, profilePaintMs=0, profileSlices=0;
  let skippedScanouts=0, lastPresentedWall=0;
  let lastDiagnosticSample=0;
  // A single IOCS call may be emitted repeatedly; keep exact event identity.
  // Legacy fake CPU fixtures are allowed to omit the audio exports, but an
  // actual rebuilt FIX29 core must expose ALL eight functions below.
  const audioFns=['_pwp_mu_audio_serial','_pwp_mu_audio_kind','_pwp_mu_audio_chain_addr',
    '_pwp_mu_audio_chain_count','_pwp_mu_audio_mode','_pwp_mu_audio_ram_ptr'];
  if (audioFns.some(name=>typeof m[name]!=='function') &&
      typeof m._pwp_mu_scanout_ticks==='function')
    throw new Error('FIX29 requires rebuilt real Musashi WASM with ADPCM exports');
  let lastAudioSerial=0;
  const consumeAudioEvent=()=>{
    if(typeof m._pwp_mu_audio_serial!=='function')return;
    const serial=m._pwp_mu_audio_serial()>>>0;
    if(serial===lastAudioSerial)return;
    lastAudioSerial=serial;
    const kind=m._pwp_mu_audio_kind()>>>0;
    if(kind!==3){host.audioControl?.(kind);return;}
    const pcm=decodeGuestADPCMChain(m.HEAPU8,
      m._pwp_mu_audio_ram_ptr()>>>0,m._pwp_mu_audio_chain_addr()>>>0,
      m._pwp_mu_audio_chain_count()>>>0,m._pwp_mu_audio_mode()>>>0);
    host.guestAudio?.({kind:'ADPCMAOT',rate:pcm.sampleRate,bytes:pcm.byteCount,
      chains:pcm.chainCount,samples:pcm.samples.length / pcm.channels});
    host.audioFrames?.(pcm.samples,pcm.sampleRate,pcm.channels);
  };

  const vblankTick = () => typeof m._pwp_mu_vdisp_ticks === 'function'
    ? m._pwp_mu_vdisp_ticks() >>> 0 : null;
  const scanoutTick = () => typeof m._pwp_mu_scanout_ticks === 'function'
    ? m._pwp_mu_scanout_ticks() >>> 0 : null;
  const optional = (name) => typeof m[name] === 'function' ? m[name]() : null;
  const sampleGuest = (phase, detail='') => {
    const hi=optional('_pwp_mu_pan_bytes_high');
    const lo=optional('_pwp_mu_pan_bytes_low');
    const readBytes=hi===null||lo===null ? null : (hi*4294967296+lo);
    const stats=guestCycleClock?.stats()??null;
    host.guestDiagnostic?.({phase,detail,wallMs:clockMs(),
      steps:optional('_pwp_mu_steps'), pc:optional('_pwp_mu_pc'), sr:typeof m._pwp_mu_register==='function'?m._pwp_mu_register(16):null,
      state:optional('_pwp_mu_status'), fault:optional('_pwp_mu_fault_address'),
      trap:optional('_pwp_mu_trap'), trapPC:optional('_pwp_mu_trap_pc'),
      exitCode:optional('_pwp_mu_exit_code'),
      panOpenCalls:optional('_pwp_mu_pan_open_calls'), panReadCalls:optional('_pwp_mu_pan_read_calls'),
      panBytes:readBytes, panIsOpen:optional('_pwp_mu_pan_open'),
      lastDosOp:optional('_pwp_mu_last_dos_op'), lastDosPC:optional('_pwp_mu_last_dos_pc'),
      lastDosReturn:optional('_pwp_mu_last_dos_return'),
      panErrorOp:optional('_pwp_mu_pan_error_op'),panErrorCode:optional('_pwp_mu_pan_error_code'),
      panErrorCount:optional('_pwp_mu_pan_error_count'),
      writeCount:optional('_pwp_mu_video_write_count'), pixelWrites:optional('_pwp_mu_video_pixel_writes'),
      crtcChanges:optional('_pwp_mu_video_crtc_changes'),r1:optional('_pwp_mu_video_vctrl_r1'),
      r2:optional('_pwp_mu_video_vctrl_r2'),mode:optional('_pwp_mu_iocs_crt_mode'),
      vdisp:optional('_pwp_mu_vdisp_ticks'),scanout:optional('_pwp_mu_scanout_ticks'),
      irqAcks:optional('_pwp_mu_vdisp_acks'),irqPending:optional('_pwp_mu_vdisp_pending'),
      irqLatched:optional('_pwp_mu_vdisp_latched'),
      gpipReads:optional('_pwp_mu_gpip_reads'),gpipLevel:optional('_pwp_mu_gpip_level'),
      cynthiaEnabled:optional('_pwp_mu_sprite_display_enabled'),
      cynthiaActiveSprites:optional('_pwp_mu_cynthia_active_sprites'),
      cynthiaDisp:optional('_pwp_mu_cynthia_disp_gate'),
      cynthiaRawSprites:optional('_pwp_mu_cynthia_raw_sprite_count'),
      cynthiaAttrWrites:optional('_pwp_mu_cynthia_attr_writes'),
      cynthiaPcgWrites:optional('_pwp_mu_cynthia_pcg_writes'),
      cynthiaPaletteWrites:optional('_pwp_mu_cynthia_palette_writes'),
      spOnCalls:optional('_pwp_mu_iocs_sp_on_calls'),
      outputSamples:completedPaints,firstVisible:firstVisiblePaint,
      frameGfxNonzero:optional('_pwp_frame_gfx_nonzero'),
      frameTextNonzero:optional('_pwp_frame_text_nonzero'),
      frameGfxTextOverlap:optional('_pwp_frame_gfx_text_overlap'),
      frameGfxPaletteZero:optional('_pwp_frame_gfx_palette_zero'),
      frameGfxVisible:optional('_pwp_frame_gfx_visible_pixels'),
      frameTextVisible:optional('_pwp_frame_text_visible_pixels'),
      paletteG0:typeof m._pwp_mu_video_palette_word==='function'?m._pwp_mu_video_palette_word(0,0):null,
      paletteG1:typeof m._pwp_mu_video_palette_word==='function'?m._pwp_mu_video_palette_word(1,0):null,
      paletteG255:typeof m._pwp_mu_video_palette_word==='function'?m._pwp_mu_video_palette_word(255,0):null,
      paletteT0:typeof m._pwp_mu_video_palette_word==='function'?m._pwp_mu_video_palette_word(0,1):null,
      paletteEvidenceStatus,paletteEvidenceColor:paletteEvidenceOffset>=0?paletteEvidenceColor:null,paletteEvidenceOffset,
      adpcmControlCalls:optional('_pwp_mu_audio_control_calls'), adpcmChainCalls:optional('_pwp_mu_audio_chain_calls'),
      conctrlCalls:optional('_pwp_mu_conctrl_calls'),conctrlMode:optional('_pwp_mu_conctrl_screen_mode'),
      clockStats:stats,measuredMHz,
      runtimeProfile:{cpuMs:profileCpuMs,pacerMs:profilePaceMs,
        paintYieldMs:profilePaintMs,slices:profileSlices,skippedScanouts}});
  };
  const clockMs = () => (typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now() : Date.now());
  const nextScanout = () => {
    const tick = scanoutTick();
    if (tick === null) return true; // Legacy unit fixtures without a raster clock only
    if (tick === lastSampledScanout) return false;
    lastSampledScanout = tick;
    return true;
  };
  const presentScanoutIfDue = () => {
    const nowMs=clockMs();
    const lateMs=guestCycleClock?.lateMs()??0;
    if (!shouldPresentScanout({lateMs,firstVisible:firstVisiblePaint,
       msSincePaint:nowMs-lastPresentedWall})) {
      skippedScanouts++; // scanout samples omitted; NOT guest PAN frames
      return false;
    }
    const changed=presentGuestVideo();
    if (changed) lastPresentedWall=clockMs();
    return changed;
  };
  // No inferred PAN frames. Only actual guest-origin pixels are presented.
  // Register-only writes MAY expose a different already-written graphics page.
  const presentGuestVideo = (force = false) => {
    const writes = m._pwp_mu_video_write_count() >>> 0;
    const pixels = m._pwp_mu_video_pixel_writes() >>> 0;
    // Page flips, palette ordering, and CRTC scroll are screen updates even
    // when the guest does not modify a single GVRAM byte. FIX17R3 gated
    // everything behind the write counter and could freeze a genuine flip.
    const r1 = m._pwp_mu_video_vctrl_r1() >>> 0;
    const r2 = m._pwp_mu_video_vctrl_r2() >>> 0;
    const crtc = m._pwp_mu_video_crtc_changes() >>> 0;
    const registersChanged = r1 !== lastR1 || r2 !== lastR2 || crtc !== lastCrtcChanges;
    // FIX34: sprite/BG-only changes can be visible without GVRAM mutations.
    const spriteEnabled=(m._pwp_mu_sprite_display_enabled?.()>>>0)===1;
    if ((!pixels && !spriteEnabled) || (writes === lastWrites && !registersChanged)) return false;
    // FIX18's wall-clock throttle discarded genuine intermediate GPU states
    // when many CPU slices completed inside one browser refresh. FIX19 never
    // skips a changed output solely because the previous update was recent.
    // The REAL VC R1 priority order determines which physical G0/G1 page
    // is visible at each enabled R2 priority slot. Never drop dual slots.
    // Physical graphics + guest CYNTHIA BG/sprites; advanced VC priority still limited.
    if ((m._pwp_mu_iocs_crt_mode() >>> 0) !== 10) return false;
    // FIX27: guest register evidence must agree with all fifteen PAN colors.
    // This does not write MMIO or alter any pixel indexes in GVRAM.
    if (paletteEvidenceRecords.length && typeof m._pwp_mu_video_palette_word==='function'){
      const evidence=matchMissingPalette0(paletteEvidenceRecords, i => m._pwp_mu_video_palette_word(i,0));
      if(evidence) setPaletteEvidence(1,evidence.color,evidence.offset,'15色照合PASS／GPal[0]欠落を表示補正');
      else setPaletteEvidence(0,0,-1,'照合不一致／補正なし');
    }
    const ok = m._pwp_frame_render_mode10(256, 256, 1);
    if (ok !== 1) return false; // Unsupported CRTC mode; don't lie about a frame.
    const n = m._pwp_frame_size() >>> 0;
    const ptr = m._pwp_frame_pointer() >>> 0;
    if (n !== 256 * 256 * 4) throw new Error('Unexpected X68000 RGBA buffer size');
    validHeap(m, ptr, n);
    const rgba = m.HEAPU8.slice(ptr, ptr + n);
    // Count distinct *visible output samples*, not PAN animation frames.
    // A full comparison avoids counting page-register writes which reproduce
    // the same pixels. Keep the last guest-derived sample, never a fake frame.
    let different = !lastFramePixels;
    if (!different) {
      for (let i=0; i<n; i++) {
        if (rgba[i] !== lastFramePixels[i]) { different=true; break; }
      }
    }
    lastWrites = writes;
    lastR1 = r1; lastR2 = r2; lastCrtcChanges = crtc;
    if (!different) return false;
    lastFramePixels = rgba;
    host.videoFrame(256, 256, rgba);
    completedPaints++;
    // Only timestamps from the real guest: this is an observed screen sample,
    // NOT a claim about the PAN movie's original frame count or frame rate.
    let signature = 2166136261;
    for (let i=0; i<rgba.length; i+=16) {
      signature = Math.imul((signature ^ rgba[i]) >>> 0, 16777619) >>> 0;
      signature = Math.imul((signature ^ rgba[i+1]) >>> 0, 16777619) >>> 0;
      signature = Math.imul((signature ^ rgba[i+2]) >>> 0, 16777619) >>> 0;
    }
    host.displayUpdate?.({number:completedPaints, guestSteps:m._pwp_mu_steps?.() ?? 0,
      pixelMutations:pixels, guestVblank:vblankTick(), guestScanout:scanoutTick(),
      signature:signature.toString(16).padStart(8, '0'), r1, r2});
    // A black image can be legitimate, but it is not the requested first
    // *visible* PAN image. Report first non-black frame separately.
    const visible = (() => {
      for (let i = 0; i < rgba.length; i += 4)
        if (rgba[i] !== 0 || rgba[i + 1] !== 0 || rgba[i + 2] !== 0) return true;
      return false;
    })();
    firstFrameNumber++;
    if (!firstPaint) firstPaint = true;
    if (visible && !firstVisiblePaint) {
      firstVisiblePaint = true;
      host.firstVisibleFrame?.({number: firstFrameNumber, pixelMutations: pixels});
    }
    return true;
  };
  // FIX30: when CPU work has already missed the virtual deadline, waiting
  // for a *second* host rAF before each output needlessly halves throughput.
  // A task yield still lets Canvas composite and STOP/input events run; do
  // not skip guest instructions, virtual V-DISP/IRQ, or output samples.
  const yieldAfterFrame = async () => {
    const began=clockMs();
    try {
      if (preferFastPaintYield(measuredMHz))
        await pause();
      else
        await waitForBrowserPaint();
    } finally {
      profilePaintMs+=Math.max(0,clockMs()-began);
    }
  };
  const pump = async (runSession) => {
    // Always yield once before executing; START can establish UI state.
    await pause();
    let lastEventLoopYieldMs=clockMs();
    try {
      sampleGuest('running');
      while (active && !stopped && session === runSession) {
        // Bounded CPU slice: ensure browser UI can process input or STOP.
        // Small instruction batches bound the maximum wall-clock lead.
        // Unlike the previous 6,000-instruction burst + 60Hz frame wait,
        // this throttles actual cycles even before the next scanout edge.
        const startCpu=clockMs();
        let result = m._pwp_mu_run(512);
        profileCpuMs+=Math.max(0,clockMs()-startCpu);
        profileSlices++;
        if (guestCycleClock){
          const startPace=clockMs();
          await guestCycleClock.pace(
            m._pwp_mu_guest_cycles(), () => active && !stopped && session===runSession);
          profilePaceMs+=Math.max(0,clockMs()-startPace);
        }
        if (!active || stopped || session!==runSession)return;
        let traps = 0;
        while (result === 2) {
          // Preserve the last guest-produced image even if a subsequent DOS
          // service is unsupported. Never fabricate pixels on exceptions.
          // DOS/IOCS or file I/O is not a physical raster boundary. Wait
          // for VBlank before presenting a partial GVRAM update.
          if (nextScanout() && presentScanoutIfDue()) await yieldAfterFrame();
          if (!active || stopped || session !== runSession) return;
          const op = m._pwp_mu_trap() >>> 0;
          const pc = m._pwp_mu_trap_pc() >>> 0;
          result = m._pwp_mu_dispatch();
          if(result!==2 && result>=1)consumeAudioEvent();
          if (result === 2) {
            const fn=(op===0x4e4f)?` / IOCS D0.B=$${(m._pwp_mu_register(0)&0xff).toString(16).padStart(2,'0')}`:'';
            throw new Error(`Unsupported DOS/IOCS ${hex(op)}${fn} at PC ${hex(pc)}`);
          }
          if (++traps > 500) throw new Error('Too many consecutive DOS services');
        }
        while (result === 3) {
          // DOS/IOCS or file I/O is not a physical raster boundary. Wait
          // for VBlank before presenting a partial GVRAM update.
          if (nextScanout() && presentScanoutIfDue()) await yieldAfterFrame();
          if (!active || stopped || session !== runSession) return;
          const length = m._pwp_mu_io_length() >>> 0;
          const capacity = m._pwp_mu_io_capacity() >>> 0;
          if (!length || length > IO_MAX || length > capacity)
            throw new Error(`Invalid WASM file request length ${length}`);
          const offset = (BigInt(m._pwp_mu_io_offset_high() >>> 0) << 32n) |
                         BigInt(m._pwp_mu_io_offset_low() >>> 0);
          if (offset > MAX_SIZE) throw new RangeError('PAN file offset exceeds JS safe integer');
          // A short Worker response inside the advertised Blob is an I/O error,
          // not EOF. Otherwise the guest would silently decode a truncated PAN.
          const expected = Number(offset >= BigInt(selected.size) ? 0n :
            (BigInt(selected.size) - offset < BigInt(length) ? BigInt(selected.size) - offset : BigInt(length)));
          const data = await host.readPan(selected.id, Number(offset), length);
          guestCycleClock?.resume();
          if (!(data instanceof Uint8Array) || data.byteLength !== expected)
            throw new Error(`PAN read length mismatch (expected ${expected}, got ${data?.byteLength ?? 'invalid'})`);
          if (!active || stopped || session !== runSession) return;
          const dst = m._pwp_mu_io_stage_ptr() >>> 0;
          validHeap(m, dst, data.byteLength);
          m.HEAPU8.set(data, dst);
          result = m._pwp_mu_supply_read(data.byteLength);
        }
        if (result === 4) {
          sampleGuest('exit',`Guest process exit ${optional('_pwp_mu_exit_code')}`);
          // Process exits may precede the first modeled VBlank. Preserve the
          // final real guest screen only if there was never a visible frame.
          if (!firstPaint && presentGuestVideo(true)) await yieldAfterFrame();
          if (session === runSession) { active = false; host.finished(); }
          return;
        }
        if (result !== 1) {
          if (!firstPaint && presentGuestVideo(true)) await yieldAfterFrame();
          sampleGuest('cpu-stop',`CPU status ${result}`);
          throw new Error(`68000 stopped: status=${result}, PC=${hex(m._pwp_mu_pc?.() ?? 0)}, fault=${hex(m._pwp_mu_fault_address?.() ?? 0)}`);
        }
        // At the beginning of a new visible scanout, expose the completed guest display.
        // Do not sample between falling edge and the guest V-DISP handler.
        const boundary = nextScanout();
        // Already paced by the actual guest cycle clock above. No second
        // 60Hz timer, which used to accumulate lag and cause catch-up bursts.
        if (!active || stopped || session !== runSession) return;
        const changed = boundary && presentScanoutIfDue();
        const a6 = m._pwp_mu_register?.(14) >>> 0;
        const h = m._pwp_mu_guest_peek8?.(a6 + 0x2c8);
        const l = m._pwp_mu_guest_peek8?.(a6 + 0x2c9);
        const frameWait = Number.isInteger(h) && Number.isInteger(l) && h <= 255 && l <= 255
          ? ((h << 8) | l) : null;
        const wallNow=clockMs();
        const cycs=m._pwp_mu_guest_cycles?.() >>> 0;
        const dt=wallNow-meterWall;
        if (guestCycleClock && dt>=250) {
          measuredMHz=((cycs-meterCycles)>>>0)/dt/1000;
          meterWall=wallNow;meterCycles=cycs;
        }
        if (wallNow-lastDiagnosticSample>=250) {
          lastDiagnosticSample=wallNow;
          sampleGuest('running');
        }
        if (boundary || wallNow-lastTelemetryWall>=250) {
          lastTelemetryWall=wallNow;
          host.guestTiming?.({ticks:m._pwp_mu_vdisp_ticks?.() ?? 0, scanout:m._pwp_mu_scanout_ticks?.() ?? 0,
            measuredMHz, targetMHz:EMULATED_68000_HZ/1_000_000, clockStats:guestCycleClock?.stats()??null,skippedScanouts,
            frameWait,
            irqAcks:m._pwp_mu_vdisp_acks?.() ?? 0,
            irqLatched:m._pwp_mu_vdisp_latched?.() ?? null,
            gpipReads:m._pwp_mu_gpip_reads?.() ?? 0,
            gpipLevel:m._pwp_mu_gpip_level?.() ?? 0,
            guestPC:m._pwp_mu_pc?.() ?? 0});
        }
        if (changed) {
          await yieldAfterFrame();
          lastEventLoopYieldMs=clockMs();
        } else if (clockMs()-lastEventLoopYieldMs>=6) {
          // Yield to input/STOP at practical intervals, not after EACH
          // 512-instruction microbatch (setTimeout(0) is clamped to >=4ms
          // in many browsers and would underclock 68000 by >10x).
          await pause();
          lastEventLoopYieldMs=clockMs();
        }
      }
    } catch (e) {
      sampleGuest('exception',e instanceof Error?e.message:String(e));
      active = false;
      if (!stopped && session === runSession) host.error(e instanceof Error ? e.message : String(e));
    }
  };
  return {
    diagnosticOnly: true,
    async load(item) {
      if (active) throw new Error('Stop current playback before loading');
      if (!item || !Number.isSafeInteger(item.size) || item.size < 0 || !item.id)
        throw new TypeError('Invalid PAN selection');
      session++;
      selected = Object.freeze({...item});
      paletteEvidenceRecords=[];
      paletteEvidenceColor=0;paletteEvidenceOffset=-1;paletteEvidenceStatus='照合対象なし';
      m._pwp_frame_set_palette0_evidence?.(0,0);
      if(Array.isArray(item.paletteEvidenceRecords))
        paletteEvidenceRecords=item.paletteEvidenceRecords;
      paletteEvidenceStatus=paletteEvidenceRecords.length
        ?`PAN内パレット候補 ${paletteEvidenceRecords.length}件／実CPU照合待ち`
        :'照合候補なし／補正なし';
      host.paletteEvidence?.({status:paletteEvidenceStatus,color:null,offset:-1,guestG0:null});
      const ptr = m._pwp_mu_stage_ptr() >>> 0;
      if (hu.byteLength > (m._pwp_mu_stage_capacity() >>> 0))
        throw new Error('PANIC.X does not fit guest HU staging');
      validHeap(m, ptr, hu.byteLength);
      m.HEAPU8.set(hu, ptr);
      const status = m._pwp_mu_load(hu.byteLength);
      if (status !== 1) throw new Error(`PANIC.X HU load failed, status ${status}`);
      // Do not start the CPU with an absent / corrupted Human68k command tail.
      // The program needs A2 to discover its single mounted PAN file.
      const a2 = m._pwp_mu_register(10) >>> 0;
      if (a2 !== COMMAND_ADDR || m._pwp_mu_guest_peek8(a2) !== PANIC_GUEST_COMMAND.length)
        throw new Error('Human68k 起動引数が正しくありません (A2 / LASCII)。');
      for (let i = 0; i < PANIC_GUEST_COMMAND.length; i++) {
        if (m._pwp_mu_guest_peek8(a2 + 1 + i) !== PANIC_GUEST_COMMAND.charCodeAt(i))
          throw new Error(`Human68k コマンドラインの不一致: offset=${i}`);
      }
      if (m._pwp_mu_guest_peek8(a2 + 1 + PANIC_GUEST_COMMAND.length) !== 0)
        throw new Error('Human68k コマンドラインに終端がありません。');
      const sz = BigInt(item.size);
      m._pwp_mu_set_pan_size(Number((sz >> 32n) & 0xffffffffn), Number(sz & 0xffffffffn));
      lastWrites = m._pwp_mu_video_write_count() >>> 0;
      lastR1 = m._pwp_mu_video_vctrl_r1() >>> 0;
      lastR2 = m._pwp_mu_video_vctrl_r2() >>> 0;
      lastCrtcChanges = m._pwp_mu_video_crtc_changes() >>> 0;
      lastFramePixels = null; completedPaints=0;skippedScanouts=0;lastPresentedWall=0;
      lastSampledScanout = scanoutTick();
      firstPaint = false; firstVisiblePaint = false; firstFrameNumber = 0;
      lastDiagnosticSample=0;
      lastAudioSerial=m._pwp_mu_audio_serial?.()>>>0 || 0;
      stopped = false;
    },
    async start() {
      if (!selected) throw new Error('No PAN loaded');
      if (active) throw new Error('Already running');
      stopped = false; active = true;
      const startCycles=m._pwp_mu_guest_cycles?.()??0;
      guestCycleClock?.reset(startCycles);
      meterWall=clockMs();meterCycles=startCycles;measuredMHz=0;lastTelemetryWall=0;
      profileCpuMs=0;profilePaceMs=0;profilePaintMs=0;profileSlices=0;
      skippedScanouts=0;lastPresentedWall=clockMs();
      lastSampledScanout = scanoutTick();
      sampleGuest('start');
      running = pump(session);
    },
    async stop() {
      sampleGuest('stop');
      stopped = true; active = false; session++;
      // Terminate the current guest on its next yield; the next `load` resets it.
      // Do not await a pending host file read, which may be slow.
      selected = null;
    },
    space() {
      // No guest keyboard/SPACE transport exists yet. Must not invent one.
      host.error('SPACE入力は未実装です（ゲスト入力が未接続）。');
    },
    async dispose() {stopped = true; active = false; selected = null; session++;}
  };
}

export async function createPanicEngine(host) {
  // Do not report READY unless genuine Musashi and original PANIC.X exist.
  let module;
  try { module = await import('../core/pwp_musashi.mjs'); }
  catch (e) { throw new Error(`Musashi WASM未接続: ${e?.message ?? e}`); }
  if (typeof module.default !== 'function') throw new Error('実MusashiのEmscripten factoryがありません。');
  const m = await module.default();
  const res = await fetch(new URL('../core/PANIC.X', import.meta.url));
  if (!res.ok) throw new Error(`オリジナルPANIC.Xがありません (HTTP ${res.status})`);
  const hu = new Uint8Array(await res.arrayBuffer());
  await checkPanicSha256(hu);
  return createMusashiBridge(m, host, hu);
}
