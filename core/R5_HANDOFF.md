# R5 engineering handoff (2026-10-23 JST)

**Confirmed:** browser PAN library available, HU header/startup proof from R3,
read-only DOS bridge + guest allocator in C, 40 tests PASS (29 Node / 11 Python).
The C tests compile the real R5 C source against a test-only fake CPU ABI.
No genuine Musashi execution has been observed in R5.

## Status transitions

- `0`: reset / not loaded
- `1`: 68000 allowed to run
- `2`: intercepted F-line/IOCS call; known DOS calls dispatched, unknown ones stop
- `3`: `_READ` waits for a bounded Blob/File range, with offset and length API
- negative: HU/guest bounds/host protocol failure

`pwp_mu_set_pan_size(hi,lo)` after successful HU load exposes exactly one
root-level read-only file. `_OPEN` accepts `P68K.PAN`, `/P68K.PAN`,
`C:\P68K.PAN` (or other drive letter at root); `_CLOSE`, `_READ`, `_SEEK`
use handle `5`. `_READ` collects multiple 64 KiB chunks without exposing a
partial result to the guest until EOF. `_READ` length 0 is refused because
actual Human68k may treat it as truncation, which is forbidden here.

`_SETBLOCK` enforces BSS floor, initial address, 4MiB budget, and existing
allocations. `_MALLOC` uses 16-byte headers and allocation-aligned user
space, with maximum 128 blocks, supports -1 query, and fails when no space.
`_MFREE` checks exact recorded user pointers and rebuilds the MCB chain.

## Still blocking playback

1. Build real pinned Musashi with Emscripten and compare instruction/PC/stack
   against the original `PANIC.X` startup. The preparation container cannot
   download Git repositories or find `emcc`, so no real-musashi compile PASS.
2. Validate Hu process/MCB against real Human68k; current context is provisional.
3. Implement remaining observed DOS calls, IOCS, memory-mapped X68000 bus,
   precise timers/interrupts, video output and YM2151/ADPCM sound.
4. Connect runtime to browser Worker; main UI intentionally stays CORE OFFLINE.

Respect user workflow: Do not request diagnostic-only runs. Work toward an
integrated functional milestone before asking for the next hardware/browser
check. Keep previous Tab5/X68K production trees unchanged.
