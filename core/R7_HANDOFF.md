# Panic Player Web R7 - handoff (2026-10-23 JST)

**R7 milestone: real isolated WebAssembly X68000 VIDEO bus, NOT a working PAN player.**

## Actual changes

- `core/pwp_x68k_video_bus.c` / `.h`: no WebX68k code. Based on verified
  `Layer812/X68KTab5/components/px68k/x68k/` source for `mem_wrap.c`,
  `gvram.c`, `tvram.c`, `crtc.c`, and `palette.c`.
- 0xc00000-0xdfffff: 2MiB GVRAM guest aperture backed by 512KiB physical
  graphics memory; PX68K-equivalent 16-colour nibble planes, 256/65536 modes.
- 0xe00000-0xe7ffff: 512KiB, four TEXT bitplanes with `^1` byte mapping,
  concurrent plane writes and 2-byte CRTC text masks.
- 0xe80000-0xe803ff: CRTC register **storage/readback subset**, not a working
  raster engine, DMA or interrupt scheduler.
- 0xe82000-0xe823ff: 1024 raw palette register bytes; VCtrl R0/R1/R2
  storage, `e82400`, `e82500`, `e82600` pages. Palette-to-display conversion
  and mixing BG/sprite/graphics/text are **not** implemented.
- A new `pwp_bus_text_index` and `pwp_bus_graphic_word` allow checking
  actual stored pixel/index data. These are **not** rendered PAN frames.
- `core/pwp_musashi.c` memory callbacks now route supported video guest
  regions to this module. Unsupported MMIO still signals a failure.
- `core/pwp_x68k_video_bus.wasm` is a **real compiled WebAssembly module**
  (LLVM/Clang) that stores/reads guest VIDEO memory. It contains **no CPU**.
  Node exercises this compiled artifact directly, without any JavaScript mock.
- `tools/BUILD_R7_MUSASHI.py` accepts a pinned upstream checkout via
  `--source` and clones it into a separate `vendor/musashi-r7-work` directory;
  never compiles/generates inside the supplied source or user Production tree.

## Verification completed

- Node.js unit tests: **34 PASS**, including direct execution of the
  compiled standalone VIDEO WASM and memory geometry/palette tests.
- Python unit tests: **14 PASS**, including GCC `-Wall -Wextra -Werror`,
  UBSan execution of the C guest CPU-memory bus and previous DOS operations.
- Total **48 PASS**. CPU semantics in C adapter tests are mock-only.
- Actual Musashi C sources could not be transferred into this runtime:
  git network `Could not resolve host github.com`, `emcc` not installed.
  Thus `core/pwp_musashi.wasm/.mjs` do **not exist**, and execution of
  actual `panic.x` by Musashi is **not** verified.

## Unimplemented, not to be mistaken for success

68000 Musashi real opcode execution, Human68k supervisor/PSP/IOCS completeness,
GVRAM raster timing, BG/sprite layer, DMA, YM2151/ADPCM, audio mixer and
synchronous browser Worker engine. The UI deliberately says `CORE OFFLINE`.
A valid .PAN test asset remains user-owned; no copyrighted PAN is bundled.

## Reproduction

```sh
python3 tools/BUILD_R7_VIDEO_WASM.py
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test*.py'
```

Actual Musashi, when pinned upstream source and Emscripten are available:

```
python tools/BUILD_R7_MUSASHI.py --source /path/to/unmodified/kstenerud/Musashi
```

The script verifies upstream Git HEAD SHA
`313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd` and never falls back to
mock CPU. No flashing, no X68K Tab/PanicPlayerTab5 source modification.
