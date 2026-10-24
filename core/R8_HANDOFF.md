# R8 HANDOFF — 2026-10-23 JST

## Result (precise)

**Confirmed new function:** A separate, real compiled WASM pipeline that converts
X68000 graphic/text VRAM held by `core/pwp_x68k_video_bus.c` into RGBA8888
pixels appropriate for `VideoOutput.frame()`. This covers a partial raster
subset in 512-dot graphics modes, NOT complete X68000 video and NOT PAN replay.

**Verification:** `node --test tests/*.test.mjs`: 38 PASS, including 4 new WASM
pixel-composition tests. `python3 -m unittest discover -s tests -p test*.py`:
16 PASS, including native GCC/UBSan C and rebuild test. 54 total PASS.

**Browser:** an independent verification page exists at
`tools/r8-video-demo.html`. Automated Chromium trial was BLOCKED by policy:
`net::ERR_BLOCKED_BY_ADMINISTRATOR` for local HTTP. No browser PASS claim.

**68000 CPU:** Real Musashi C sources were not available to this container;
`core/pwp_musashi.mjs` / `.wasm` do not exist. The repository remains
`CORE OFFLINE` for `.PAN` playback. Do not turn the local DOS mock into
an artificial `PASS`. Source pin for real Musashi remains
`313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd` from
`https://github.com/kstenerud/Musashi`.

## New source

- `core/pwp_x68k_frame.c/.h`: bounded guest VRAM raster. A 512x512 RGBA
  buffer, 16 color graphical page 0–3, 256 color page 0–1, 65536 direct-color
  page 0, page-specific graphic scroll and optional 4-plane nonzero TEXT
  overlay with text scroll. Native GRBi is 5G/5R/5B/I; each channel is
  6-bit from `(component<<1)|I`, scaled to 8-bit with rounding.
- `core/pwp_x68k_video_frame.wasm`: actual `clang --target=wasm32` binary;
  includes existing bounded bus, no CPU and no external imports.
- `tools/BUILD_R8_VIDEO_WASM.py`: reproducible strict rebuild.
- `tools/r8-video-demo.html`: separate demo uses real bus writes and Canvas;
  header explicitly says diagnostic pattern, not PAN playback.
- `tools/BUILD_R8_MUSASHI.py`: source-pinned Emscripten build recipe updated
  to include the R8 raster module in the eventual real CPU output. It has
  **not** been executed successfully: required upstream source/emcc unavailable.
- `tests/video-frame-wasm.test.mjs`, `tests/mock/test_r8_frame.c`,
  `tests/test_r8_frame.py`: direct binary and native C regressions.

## Known incomplete portions (must not be silently faked)

- CPU: real Musashi not compiled; DOS/IOCS calls beyond R6 incomplete,
  actual native PANIC.X under Musashi not verified.
- Video: sprites and BG, priority registers/visibility masks, CRTC raster
 /interrupt cadence, fast clear/copy, 1024-pixel modes, and precise guest
  frame scheduling absent. The optional text overlay is only a **fixed
  order preview**, not a faithful priority compositor.
- Audio: YM2151/ADPCM, timers and browser audio scheduling absent.
- Browser: `src/panic-core.mjs` remains absent, intentionally; the UI should
  continue to say `CORE OFFLINE`. Diagnostics page works independent of
  the main user app when the browser allows localhost access.

## Rebuild

```
python3 tools/BUILD_R8_VIDEO_WASM.py
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test*.py'
```

Windows `START_R8_BUILD_WINDOWS.cmd` / Linux `START_R8_BUILD_LINUX.sh`
run the same build + verification. To additionally compile real Musashi when
upstream and Emscripten are present, explicitly set `PWP_BUILD_MUSASHI=1` and
optionally point `PWP_MUSASHI_SOURCE` at a read-only pinned Git checkout.
No PIN fallback or mock CPU in release output.

## Safety and rights

User `.PAN` media stays user-local, no bundled third-party PAN content.
Original `panic.x` V1.38, Musashi and PX68K ownership/licenses remain
with their respective authors. No WebX68k dependencies. Production Tab5
source/firmware is untouched.
