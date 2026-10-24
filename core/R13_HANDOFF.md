# Panic Player Web — R13 handoff

## Baseline

Starting point: the unmodified R12 package, except for R13 changes noted below.
WebX68k not used; existing `X68KTab5` / `PanicPlayerTab5` remains READ ONLY.
PAN video and music are **NOT** functional yet.

## Technical advance

R12 requires Emscripten (`emcc`) before it can run any *real* 68000
instructions. R13 inserts a native, real Musashi CPU stage before the WASM
stage, using the same C adapter, the same Tab5 fork, and the authentic
PANIC.X SHA256 pin. This allows investigation of genuine CPU/runtime faults
with normal GCC/Clang and no Emscripten. **Not a diagnostic-only fake build**:
the native shared library actually executes a synthetic 68000 program and
the first six instructions of authentic PANIC.X.

### R13 source modifications

- `core/pwp_musashi.c`: new `pwp_mu_stage_native_ptr()` returning `uintptr_t`
  on non-Emscripten native hosts. Existing wasm32 `pwp_mu_stage_ptr()` ABI
  remains unchanged. On x86_64 a 32-bit pointer API cannot be safely passed
  into `ctypes.memmove`.
- `tools/BUILD_R13_HOST_CPU.py`: copies **13 exact local Tab5 fork source**
  files to a disposable snapshot and records SHA256 before compilation. This
  does not alter the user's Production source tree. Builds a temporary
  `.dll`/`.so`/`.dylib` with genuine Musashi.
- `tools/RUN_R13_NATIVE_CPU.py`: loads that actual native library and
  executes CPU instructions (MOVEQ, ADDQ, NOP), two DOS calls, then
  authentic PANIC.X startup through `_SETBLOCK` (0xFF4A, PC 0x10012).
  It verifies A2, command line, and the exact SHA256 of PANIC.X.
- `START_R13_BUILD_WINDOWS.cmd` / `.sh`: one command invokes real native CPU
  acceptance, then R12's genuine Musashi WASM build + Node CPU acceptance.
- `tests/test_r13_native_gate.py`: verifies the native 64-bit memory interface,
  and confirms mock CPU fails the genuine CPU test; confirms missing input
  fails closed with no success evidence.

## Actual acceptance criteria

1. Native compiler builds the **real** local Musashi fork to a shared library.
2. The actual 68000 executes MOVEQ(42), ADDQ.L(1) and NOP; D0 equals 43.
3. Native DOS `_MALLOC(0)` gives -8 and `_EXIT2(0)` terminates.
4. The **authentic** PANIC.X V1.38 executes 6 actual 68000 instructions,
   reaches 0xFF4A at 0x10012, and returns D0=0 after `_SETBLOCK`.
5. Only then run `emcc` WASM compilation + R12's real CPU/PANIC startup tests.
6. No completed PAN media playback claim until verified graphics, timing,
   sprites and audio on genuine PAN files.

`R13_REAL_HOST_CPU_EVIDENCE.json` is produced **only on actual native PASS**.
On any failure the file is removed. No evidence file is bundled in the
unverified source release.

## Current build-environment limitations

Here, 64-bit GCC/Clang and Node/Python exist; complete Musashi sources and
Emscripten do not. The host-native runner has been compiled **against a mock
only to verify the 64-bit interop and rejection**, not to claim actual 68000
execution. **Native real Musashi / authentic PANIC.X / emcc WASM are not PASS.**

## Windows use (one command, after development sources are available)

Extract the R13 ZIP separately from the Production tree, then run:

```cmd
START_R13_BUILD_WINDOWS.cmd "G:\X68KTab5"
```

Or a different checkout path as its first argument. The command performs
native CPU acceptance first. With Emscripten installed, it proceeds directly
to WASM build and actual CPU acceptance. All files are created in the R13
staging directory; sources under G: are only read.

This should not be confused with real graphical PAN playback.
