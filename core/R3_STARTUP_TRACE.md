# R3 HU startup evidence — 2026-10-23

**Scope:** This is a *limited* PANIC.X 68000 startup check, not a PANIC engine.
No Musashi CPU library has been vendored or built in R3. No DOS/IOCS service
is executed. No PAN schedule, audio or video frames are executed/generated.

## Provenance

User project: `Layer812/X68KTab5`, source `src/panic_x_bin.c`, default branch
source inspected 2026-10-23. Binary signature HU, total **15,412 bytes**.
Actual header fields verified directly from original public C byte array:

| Field | Value |
|---|---:|
| text bytes | `0x39A2` |
| data bytes | `0x0252` |
| BSS bytes | `0x1772` |
| relocation bytes | `0` |
| entry offset | `0` |

Loader setup: code base `0x10000`, initial data end `0x13BF4`, BSS end
`0x15366`, entry PC `0x10000`. The fixture tests use **the exact initial
machine-code instructions copied from the public PANIC.X byte array** with
an artificially zero-filled rest of a correctly structured 15,412-byte HU
container, not a real playable binary. User-generated PANIC.X is not bundled.

## Actual seven opcodes executed by the experimental R3 WASM bootstrap

| PC | Opcode | Observed change |
|---|---|---|
| `0x10000` | `4DFA 3BF2` | `LEA ...,A6` => A6=`0x13BF4` |
| `0x10004` | `4FFA 5360` | `LEA ...,A7` => A7=`0x15366` |
| `0x10008` | `41E8 0010` | `LEA 16(A0),A0` => A0=`0x20010` (test fixture) |
| `0x1000C` | `93C8` | `SUBA.L A0,A1` => A1=`0xFF0` (test fixture) |
| `0x1000E` | `2F09` | `MOVE.L A1,-(A7)` => pushes `0x00000FF0` |
| `0x10010` | `2F08` | `MOVE.L A0,-(A7)` => pushes `0x00020010` |
| `0x10012` | `FF4A` | First Human68k F-line/DOS trap **detected only** |

This verifies an important architectural boundary: the executable uses
Human68k F-line traps immediately; a 68000 interpreter alone will not run
PANIC.X. The *correct* next milestone is integrating Musashi and a
sufficient real Human68k-compatible DOS/IOCS/host I/O implementation,
not falsely returning success for `FF4A`.

## Verification

- Compile new C interpreter to genuine wasm32 using Clang/wasm-ld.
- Node WebAssembly instance reads original startup byte signature/fixtures.
- Tests assert the seven machine instructions actually executed in WASM,
  register state, big-endian memory writes and trap number.
- Corrupt/malformed HU, truncated image, unsupported relocation, too-large
  BSS and unsupported instruction fail closed.
- R2 file-I/O tests remain enabled and are run with the new tests.
- Browser Worker probe available at `/tools/r3-probe.html`, requiring the
  user's already-owned PANIC.X; **no headless-browser pass is claimed**.

## Known omissions

Full 68000 CPU/Musashi, DOS syscall table, IOCS traps, CRTC/GVRAM, sprite,
YM2151, ADPCM, interrupts, timers, actual `.PAN` media playback, and
browser hardware verification. No fake graphics or audio are generated.
