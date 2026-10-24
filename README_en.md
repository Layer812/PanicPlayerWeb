# Panic Player Web

[日本語](README.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

**A standalone browser player for X68000 PANIC (`.PAN`) animation data.**

Panic Player Web executes the authentic **PANIC.X V1.38** application through a real **Musashi Motorola 68000** emulation core. It emulates X68000 video layers (graphics, text, sprites/BG), priority registers, V-DISP and MSM6258 ADPCM audio rather than merely replaying a converted video.

The project grew from [panicplayer for M5Stack Tab5](https://github.com/Layer812/PanicPlayerTab5) and [X68K Tab](https://github.com/Layer812/X68KTab5), but is an independent Web implementation.

## Features

- Genuine PANIC.X running in Musashi 68000
- Graphics/TEXT/sprite/BG rendering, video controller priority, palette handling
- 16MHz guest CPU configuration with deadline-based frame pacing
- ADPCM audio, PLAY/STOP, PREV/NEXT, REPEAT and FOLDER AUTO
- Local PAN/folder loading and collapsible playback diagnostics
- Optional listing of public, authorized PAN files from this repository's `main/pan/` folder. Data downloaded only on a PLAY/PREV/NEXT action and checked for expected size and Git blob hash

## Build & run

**Source publishing is different from a ready-to-play GitHub Pages deployment.** This repository deliberately does not bundle authentic PANIC.X, third-party Musashi sources or a compiled Musashi CPU WASM. You must supply authorized source inputs and build locally.

Windows developer example (Python 3, Node.js 20+, Emscripten required):

```bat
py -3 tools\START_PLAY.py --source "G:\X68KTab5" --pan "G:\MyPAN\example.PAN"
```

The builder verifies PANIC.X against a pinned SHA-256 value and compiles the real Musashi CPU WASM. Use `npm test` for JS regressions and `python -m pytest -q tests` for Python regressions. Not every PAN works perfectly; some have known end-of-playback compatibility problems.

## Rights and acknowledgments

- Web code newly authored for this project: © 2026 Layer812 (MIT, only for Layer812-owned work)
- PANIC / PANIC.X: original author/copyright holder **Hideya Nagata (pako)**; V1.38 revisions by **Nashimi**
- Musashi M680x0: © Karl Stenerud and contributors, MIT License
- Technical lineage and references: PX68K, WinX68k, xkeropi and their contributors
- SHARP X68000 and related trademarks belong to their owners; this project is unofficial

**PANIC.X redistribution permissions do not license individual PAN animations or their music/artwork.** Put only media you are authorized to redistribute into `pan/`. Original PANIC documentation is preserved in [PanicPlayerTab5/docs](https://github.com/Layer812/PanicPlayerTab5/tree/main/docs). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE_PANIC_X.txt](LICENSE_PANIC_X.txt), and [PANIC_V1.38_NOTICE.txt](PANIC_V1.38_NOTICE.txt) for details.
