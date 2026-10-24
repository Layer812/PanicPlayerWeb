# PANIC native-runtime extraction plan — grounded in user's public X68K Tab source

**Verified source:** `Layer812/X68KTab5` GitHub `main` commit
`b8a5f29c747f4345060b32a34f190f9339d5b577` (as retrieved 2026-10-23).
Do not claim that PanicPlayerTab5 itself publishes a complete core. The *X68K Tab*
repository DOES publish the actual, integrated PX68K/Musashi sources and
`src/tab5_panic.cpp`, `src/panic_x_bin.c`, guest hardware and audio/video glue.

## Observed source ground truth

- `src/tab5_panic.cpp`: creates `/sdcard/P68K.X` from original 15412-byte
  `panic_x_bin` and stages chosen PAN as `/sdcard/P68K.PAN` using 16KiB
  chunks. `P68K.BAT` invokes `C:\\P68K.X C:\\P68K.PAN` with actual runtime
  drive letter. This *does not* perform in-memory PAN decoding.
- Guest uses **Musashi** 68000 (`components/px68k/m68000/...`) with other
  PX68K components (`x68k/*`) and PX68K/libretro glue.
- File runtime is HostFS (`components/px68k/x68k/hostfs.c`). Guest-visible
  support includes DOS operations beyond read: FILES, CHMOD, OPEN, SEEK,
  which is why Tab5 stages an 8.3-safe file, rather than hooking OPEN only.
- Guest draws via graphics, sprite, text and OPM/ADPCM paths, not a stream
  of readily encoded RGBA frames. Browser rasterization/audio integration
  must actually port necessary hardware/timing paths.

## R2 achieved (no emulator)

A native C `pwp_guestfs.c` module is compiled to real wasm32
(`pwp_guestfs.wasm`); it mediates SEEK/READ requests through synchronous
`pwp.read_file` host import. FileReaderSync reads only required Blob slices
inside a dedicated Worker; no `File.arrayBuffer()` over entire large PAN is
needed. The Node WASM round-trip, bounded I/O and EOF semantics are tested.
This is **only the future guest file-I/O boundary**, not guest DOS itself.

## Real-engine integration checkpoints (next)

1. Pin exact source commit above; copy into a separate port tree. No edits to
   original Production or source repository. Inventory source and licenses.
2. Build PX68K/Musashi runtime with Emscripten (currently unavailable in
   this runtime) while removing only ESP-IDF/M5Stack-specific services.
3. Implement guest-compatible DOS/IOCS and proper `P68K.X` load, or port the
   verified Human68k runtime and legal assets. Do not assume DOS trap support
   is trivial; use actual `hostfs.c`, `main.c` behavior as primary evidence.
4. Map guest file operations for both `P68K.X` and selected `P68K.PAN`, not
   just a single read hook; ensure naming, seek, directory enumeration and
   attribute calls behave as the validated baseline.
5. Implement video raster, OPM/ADPCM/audio timing, MFP/interrupts and SPACE
   guest input in a worker-driven bounded execution pump.
6. Accept actual-playback milestone only after real `.PAN` video/audio
   compared against known Tab5 playback. No fabricated test clips.

## Third-party obligations

This package does **not** include original PANIC.X, firmware images, the
X68K Tab core or other third-party binaries. The extract script works from
an existing local source copy. Use original PANIC V1.38 permission texts;
check PX68K/Musashi licenses and relevant GPL obligations. Individual PAN
animations are separate author-owned media. SHARP/Human68k/CGROM licensing
conditions need independent review before publication.
