# R9 engineering handoff / 2026-10-23

## Root problem and evidence

R8 did not include Musashi source or a compiled CPU WASM. It was not
possible to confirm PANIC.X actual execution. The R9 container likewise
has no upstream source, no Emscripten and no DNS route to GitHub.
The real core MUST NOT be replaced by the existing `tests/mock/mock_m68k.c`
for any acceptance claims. The synthetic smoke executes real 68000 opcodes
only when `pwp_musashi.mjs` was built from the pinned source.

## R9 guest bus changes

- `pwp_musashi.c`: `physical24` masks every bus transaction, so 0x01001000
  and 0x00001000 use the same RAM. Original unmasked address retained as
  `fault_addr` for unsupported MMIO.
- `pwp_x68k_video_bus.c/h`: `pwp_bus_writable8` checks the actual
  writeability of CRTC register aliases. Multi-byte guest write `span`
  preflight checks writeability rather than mere readability. Example:
  guest write32 at `0xe8002e` is rejected without changing CRTC[0x2e].
- `_READ(handle, ptr, 0)` for read-only PAN returns zero and does not
  request host I/O; previous R8 returned an incorrect read-only error.
- These changes received host native C/UBSan checks; they do not imply
  actual Musashi execution or screen rendering from a running guest.

## Actual CPU build acceptance

- `tools/BUILD_R9_MUSASHI.py` carries forward the R8 source pin,
  builds `m68kmake`, compiles real Musashi and the existing C adapter, and
  writes a temporary Emscripten `.mjs/.wasm` pair to `vendor/r9-build-stage`.
- It verifies WASM magic and runs a Node test of real opcodes through the
  exported Musashi ABI before promoting the files to `core/`.
- Smoke fixture HU bytes: `70 2A 52 80 4E 71 FF 48 FF 4C` (MOVEQ #42,D0;
  ADDQ.L #1,D0; NOP; `_MALLOC`; `_EXIT2`). Expected: 43 in D0 before
  `_MALLOC`, three executed instructions, `_MALLOC(0)` returns -8, then
  `_EXIT2(0)` ends the process.
- With verified original `PANIC.X` available, its startup must run six
  non-trap CPU instructions and stop at `FF4A` at PC 0x10012; then the
  `_SETBLOCK` dispatcher must return success. The old R3 limited interpreter
  counted the intercepted F-line as an additional step; R9's Musashi bridge
  counts only **executed** instructions, hence six, not seven.
- The first original DOS startup trap test is not PAN playback. It cannot
  validate timings, graphics, audio or unsupported DOS/IOCS paths.

## Test evidence

- `START_R9_BUILD_LINUX.sh` clean run: JS 38 PASS, Python 20 PASS.
- `python3 tools/BUILD_R9_MUSASHI.py --offline`: nonzero exit, exact
  missing pinned checkout as expected.
- `node tools/RUN_R9_CPU_SMOKE.mjs`: nonzero `ERR_MODULE_NOT_FOUND`
  because real Musashi WASM does not exist in this environment.
- Therefore **actual Musashi CPU execution: NOT VERIFIED**.

## Open, in priority order

1. Obtain permitted real source in a suitable build environment and build
   pinned Musashi via R9; fail closed unless actual HU smoke passes.
2. Run original PANIC.X startup test and trace subsequent DOS calls; fix
   verified missing calls/guest memory semantics only.
3. Map remaining X68000 hardware accurately: IOCS/interrupt service, raster
   timing, BG/sprites and priority, YM2151 + ADPCM, synchronization.
4. Implement actual engine hooks for browser UI and test PAN playback with
   user-owned PAN. Until then `CORE OFFLINE` is correct.

## Production preservation

No user device was flashed. Existing X68K Tab or PanicPlayerTab5 trees were
not modified. WebX68k is not used. Do not bundle ROM, X68000 system files or
third-party PAN content. Preserve source provenance and run release license
review separately.
