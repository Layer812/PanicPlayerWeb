# R4 engineering handoff

## What is established

- Independent (non-WebX68k) adapter design compiled warning-free against a
  *test-only* Musashi ABI mock using host GCC -Wall -Wextra -Werror.
- A pinned upstream Musashi generator + Emscripten compile script has been
  authored and syntax validated, **but not run** with genuine upstream source
  and Emscripten in this environment.
- Synthetic HU loader/memory block fixtures establish the adapter's expected
  data and failure semantics. Previous R3 WASM exercises seven real machine
  instructions only, not the complete original binary.

## Known initial machine layout

HU source header 0x40; LOAD_BASE 0x10000; original text 0x39A2,
data 0x252, BSS 0x1772, relocation 0; candidate original V1.38 length
15412 bytes. R4 uses a synthetic MCB at 0xFFF0, A0=0xFFF0, A1=0x3F0000,
with a block-end pointer at [0xFFF8]. This is a plausible process model,
**not proven equivalent to Human68k**.

`FF4A` detected at PC=0x10012 on R3 (R3 synthetic HU with actual startup
opcode bytes). In R4, only `FF4A`/`_SETBLOCK` is handled as a limited one
process memory-block resize. Other F-line traps remain explicitly blocked.

## Musashi integration risk inventory

- Real upstream `m68kcpu.c` uses generated `m68kops.[ch]`; `m68kmake` must run
  with working directory = source root.
- It is not yet known whether the pinned upstream compilation with the
  selected Emscripten flags will pass warning/link/runtime validation; do NOT
  print `MUSASHI PASS` unless it does.
- `m68k_execute(1)` and `m68k_get_reg()` must be checked against a real
  PANIC.X image to confirm one-instruction stepping works as expected.
- The guest runs in user mode, with vector and initial PSP values staged
  before reset. These need comparison against Human68k original semantics.
- Hardware read/writes to 0xE00000 and above presently STOP as unsupported.
  Absolutely do not fake success/video/audio.
- DOS `_MALLOC`, `_OPEN`, `_READ`, `_SEEK`, `_FILES`, IOCS, timers and interrupt
  sources remain missing; no PAN frame will be displayed on R4.

## Next validation

Once the pinned upstream build is available, run `node
 tools/RUN_R4_PROBE.mjs /path/to/PANIC.X` and save trace. A real verified
first-trap + next-service trace is the next meaningful milestone; user should
not be asked for repetitive isolated micro-tests.
