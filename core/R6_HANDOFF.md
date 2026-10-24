# Panic Player Web R6 — integration handoff

Date: 2026-10-23 JST

## Authoritative state

**Not playable.** The browser UI and file library from R1–R5 are still present;
`main.js` deliberately reports `CORE OFFLINE` until the actual 68000 emulator,
video compositor and sound engine can produce real PANIC frames. R6 does not
claim a working compiled Musashi WASM. Neither WebX68k nor its components are
used, and Tab5 production was not edited.

## R6 implementation facts

Source: `core/pwp_musashi.c` — all R5 read-only file/memory features preserved.

- The 68000 guest's 16-bit and 32-bit memory reads/writes now reject odd
  addresses rather than silently behaving like a generic byte array.
- `_INTVCS` (`FF25`) and `_INTVCG` (`FF35`): bounded vector bookkeeping in
  guest memory (interrupt vectors 0–255) and in separate IOCS/DOS vector
  registries (0x0100–0x01ff, 0xff00–0xffff). The fact that callbacks may be
  **stored** does not imply that their handlers are runnable. Unsupported
  vector ranges fail with `-14`; out-of-range handler pointers fail with `-14`.
- `_PRINT` (`FF09`): reads a bounded NUL-terminated guest string, captures
  bytes in an 8192-byte diagnostic buffer, tracks truncation, and never writes
  arbitrary host memory or posts these bytes to a network service.
- `_EXIT` (`FF00`) and `_EXIT2` (`FF4C`): set status `4` (terminated), capture
  the exit code, close the read-only PAN handle and disallow further CPU steps.
- `_SEEK` checks 64-bit size *before* conversion to signed integers. Invalid
  positions use DOS `-25` and never change the file offset; R5 erroneously
  returned DOS `-22` (file already exists) for these conditions.
- R5 I/O pending transfer validates base-address arithmetic for overflow.
- New exported queries: `pwp_mu_console_length`, `pwp_mu_console_byte`,
  `pwp_mu_console_truncated`, `pwp_mu_exit_code`.

JavaScript: `src/musashi-r6-probe.mjs` reports bounded console output in
Shift-JIS, structured DOS traps, guest instruction count, normal process
termination, and explicit trace-budget exhaustion. Always `playable:false`.
It is a development probe, **not** the browser playback engine.

## Automated evidence vs missing evidence

The native test compiles the **real R6 DOS adapter C code** against a *test
only* CPU ABI stub (`tests/mock/mock_m68k.c`) with `gcc -Werror` and UBSan.
All DOS cases use synthetic arguments and must not be interpreted as having
executed genuine 68000 instructions. The Node tests similarly exercise JS
orchestration without claiming actual Musashi.

The original Musashi source at pinned upstream commit
`313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd` is required for actual CPU
execution. The preparation environment could not resolve github.com from its
container network, and Emscripten (`emcc`) is not installed. As a result,
**no `core/pwp_musashi.mjs` or `core/pwp_musashi.wasm` is included.**

R6 build (only in a suitable toolchain environment):

```sh
./START_R6_BUILD_LINUX.sh
node tools/RUN_R6_PROBE.mjs /path/to/PANIC.X /path/to/OWN.PAN
```

`PANIC.X` must be supplied by the owner, or extracted by the existing
`tools/EXTRACT_PANIC_X.py` from its original source. No copyrighted user PAN
animations are bundled.

## Next **implementation** tasks (not diagnostic-only runs)

1. Compile actual Musashi into WASM; validate guest PC, stack and memory against
   actual PANIC V1.38 startup.
2. Provide accurate `_SUPER`, IOCS/interrupt dispatch and Human68k PSP setup.
3. Map X68000 graphics hardware RAM/registers and YM2151/ADPCM sound events.
4. Wire Worker/render/audio to the actual runtime; verify multiple real PANs.

Until then, avoid claiming playable status or using a mock CPU in production.
