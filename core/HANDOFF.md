# Independent PANIC core extraction and WASM port — implementation handoff

## Evidence available

- Layer812/PanicPlayerTab5 public README: PANIC V1.38, Musashi CPU, PX68K hardware model and HostFS/SD-file selection.
- Past Tab5 patch notes show panic.x/PAN staging, HostFS `.BAT` command invocation, touch -> guest SPACE, 68000 execution on a dedicated CPU task.
- The **actual complete private Tab5 source tree is not available in this R1 artifact**. Do not invent functions or claim it was compiled.
- Original V1.38 docs state historical bug-compatible scheduling is intentional; do not 'fix' its guest semantics accidentally.

## Source acquisition, preserving Production

1. Copy the exact existing `PanicPlayerTab5` source tree to an isolated port workspace, read-only at origin. Preserve source identities/checksums and all relevant license texts.
2. Inventory entrypoints and dependencies rather than assuming all ESP32-P4-specific services can compile to WASM.
3. Isolate portable Musashi, guest memory, MMIO, CRTC, sprite, MFP/interrupts, OPM and ADPCM modules; leave ESP-IDF/Tab5 LCD/USB/SD drivers out.
4. Replace the FreeRTOS guest-task service with an explicit bounded execution pump suitable for a Web Worker. Preserve guest CPU cycle/timer ordering.
5. Map guest filesystem reads to a browser virtual drive. Because File reads are asynchronous, either stage each selected file in WASM/OPFS before starting or build an async worker bridge; **never silently assume a synchronous browser File API exists**.
6. Mount licensed `panic.x` V1.38 and any required Human68k assets only after rights review. Prefer eliminating the Human68k OS dependency through a separately tested DOS/IOCS/BIOS compatibility layer if technically practical.
7. Connect host video to `videoFrame(width,height,rgba)` (RGBA8888) and host audio to `audioFrames(Float32Array,rate,channels)` while tracing guest clock/timing.
8. Support lifecycle `load/start/stop/space/dispose` and final completion callback. Test repeat, next/back, large file reads, recovery after a failed file, smartphone touch, and core teardown.

## JS runtime contract

`src/panic-core.mjs` exports `async function createPanicEngine(host)` returning:

- `await engine.load({id,name,size})` — stage or attach the selected file through `await host.readPan(id,offset,length)`; **do not call success until staging and guest reset are complete**.
- `await engine.start()` — begin guest execution, synthesize actual video/audio.
- `await engine.stop()` — stop guest, release runtime resources safely.
- `engine.space()` — inject a guest SPACE key event with correct keydown/up handling.
- `await engine.dispose()` — final teardown.

Callbacks:

- `host.readPan(id, offset, length): Promise<Uint8Array>` — max chunk 2 MiB.
- `host.videoFrame(width, height, rgba)` — tightly packed `Uint8Array` RGBA8888; width/height <= 2048.
- `host.audioFrames(interleavedFloat32, sampleRate, channels)` — 1 or 2 channels, 8–192 kHz. Timing controlled by guest, with buffered browser playback.
- `host.finished()` / `host.error(detail)` — explicit completion and errors.

## Critical acceptance criteria

No 'PASS' for playback without viewing real .PAN frame output and hearing expected FM/ADPCM sound. No WebX68k component. Keep large-font high contrast UI. Do not ask for repeated diagnostic-only device runs. Keep any future source extraction and browser build in a single deliverable after meaningful implementation progress.
