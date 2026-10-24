# R10 handoff — 2026-10-23

Actual local delivery: independent browser-to-real-Musashi bridge with fail-closed CPU and binary requirements.

Source status: R9 archived and copied without changing prior artifacts. Browser module `src/panic-core.mjs` requires actual Emscripten Musashi output `core/pwp_musashi.mjs/.wasm` and original `core/PANIC.X`, SHA256-pinned. Without those inputs `createPanicEngine()` throws; browser shows CORE OFFLINE.

Runtime protocol: 6,000-instruction bounded slices; DOS state 2 -> dispatch; host-read state 3 -> bounded 64KiB `readPan` and `supply_read`; state 4 -> finish; negative state -> explicit stop. `session` number rejects stale pending reads after STOP/reload. Guest VRAM changes trigger only the existing partial 512x512 raster conversion; no fake playback stream.

Musashi pin: upstream kstenerud/Musashi commit 313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd. Original PANIC.X binary from Layer812/X68KTab5 `src/panic_x_bin.c` SHA256 f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd.

Real CPU acceptance: `tools/BUILD_R10_ACTUAL.py` requires actual Musashi and authentic PANIC.X to build the real Emscripten WASM and run both synthetic-HU opcode smoke and original PANIC.X initial FF4A trap. No fallback if source / toolchain unavailable. In this environment absent source+emcc so NOT PASS.

NOTE: Node tests for new bridge use a deliberate fake test double for ABI protocol only. Native R9 adapter tests use mock CPU. Actual Musashi CPU: not built. Full PAN playback: not achieved.

Outstanding: Connect/verify source and Emscripten in a real build environment, run original startup, inspect next encountered DOS/IOCS and MMIO, then implement actual effects and sound. No diagnosis-only hardware steps are requested of the user.
