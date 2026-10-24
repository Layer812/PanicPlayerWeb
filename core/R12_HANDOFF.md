# R12 engineering handoff

## Authoritative prior baseline
R11 archive was copied into R12 without changing its established browser or
DOS functionality. R11's 73 regression cases were 51 Node and 22 Python.

## R12 changes
- `tools/BUILD_R12_ACTUAL.py`: Read-only Tab5 Musashi source selector,
  complete SHA256 census, isolated source copy, actual Emscripten link,
  two real CPU acceptance gates, conditional output publication and JSON
  origin manifest. No hidden mock CPU build mode.
- `core/pwp_musashi.c`: `PWP_TAB5_MUSASHI` interrupt acknowledgement
  implementation for fork config; this **does not** qualify correct physical
  interrupt/IOCS semantics for animations.
- `START_R12_BUILD_WINDOWS.cmd`, `START_R12_BUILD_LINUX.sh`: one-command
  local source path, default G:\\X68KTab5 under Windows.
- `tests/test_r12_local_source.py`: source hash, immutable copy,
  missing-tool fail-closed and native ABI verification.

## Never infer test results
A native C mock test only verifies the bridge's types and memory semantics.
A WASM VRAM raster test only verifies raster pixels. Only actual
`RUN_R9_CPU_SMOKE.mjs` plus `RUN_R9_PANIC_BOOT.mjs` passing against the real
Musashi module can establish the first genuine 68000 startup milestone.
Even that milestone does not establish PAN playback or sound.

## Current block
The sandbox cannot reach GitHub via a shell network connection, contains no
checked-out Musashi sources, and lacks Emscripten. Genuine CPU build and
bootstrap are therefore still unverified. Do not claim that all real hardware
features are working from R12's regression results.

## Next implementation focus
Once actual compiler output is available, fix all real upstream/fork
incompatibilities, verify instructions and DOS services, and complete
MFP/IOCS, sprite/BG, YM2151/ADPCM and guest scheduling so actual PAN media
can play. Do not ask for separate diagnostics-only user runs.
