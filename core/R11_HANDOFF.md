# Panic Player Web R11 — startup boundary correction

2026-10-23 JST

## Directly fixed

- R10 initialized `A2` to zero even though the Human68k `.X` loader supplies
  the command-line address in `A2`.
- R11 writes a length-prefixed LASCII argument, ` C:\P68K.PAN` plus trailing
  zero, into a fixed valid guest RAM address `$008000`, and sets `A2=$008000`.
  The virtual path exactly corresponds to the path supported by the bounded
  DOS `_OPEN` handler and to the path staged in the published X68KTab5 PANIC
  launcher. Guest hardware and host paths remain isolated.
- The C source exports an out-of-bounds-safe read-only guest-byte accessor
  to validate the process startup ABI from real generated WASM.
- The real-Musashi PANIC boot acceptance test now checks the initial `A2`,
  LASCII length, each byte of the command line, and the terminator **before**
  the first real DOS `FF4A` / `_SETBLOCK` stop; a CPU stub cannot pass that
  test because the script requires a genuine compiled Musashi module.
- The browser bridge also validates this startup contract at `load()` and
  refuses to start a guest with missing/wrong command line.
- Authentic PANIC.X input lookup supports an explicit local read-only
  X68KTab5 checkout and common Windows `G:\X68KTab5` paths. No search across
  the user's drive and no changes to their Tab5 Production data.

## Test claim boundary

- Native C HU/register check uses `tests/mock/mock_m68k.c`: **not** CPU proof.
- JavaScript bridge checks use a fake ABI: **not** CPU proof.
- Existing R7/R8 video WebAssembly tests run real compiled video modules:
  **not** evidence that PANIC animation works.
- Actual pinned Musashi + original PANIC.X instruction test remains a **hard
  build gate**. The builder never labels CPU work as PASS if those tools/data
  are missing.
- DOS/IOCS completeness, sprites/BG, interrupts/timing, YM2151/ADPCM,
  and PAN animated playback are not yet implemented.

## Next verified transition

With Python, Node.js, GCC/Clang host compiler, Git, Emscripten `emcc`, the
pinned upstream `kstenerud/Musashi` commit
`313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd` and original
`PANIC.X` (SHA256 `f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd`), run:

```sh
./START_R11_BUILD_LINUX.sh --musashi-source /path/to/pinned/Musashi \
  --x68ktab-root /path/to/local/X68KTab5 --offline
```

or on Windows (when all tools are available in PATH):

```bat
START_R11_BUILD_WINDOWS.cmd --x68ktab-root G:\X68KTab5
```

If upstream source is absent and `--offline` is omitted, the build attempts
an isolated Git clone and checks the exact commit. If anything fails, it
stops without publishing a fake CPU binary. Original PANIC.X is never
bundled with this archive. No user-owned PAN files are redistributed.
