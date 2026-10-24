# Panic Player Web

[日本語](README.md)

I wanted to revisit X68000 **PANIC** animations after many years. I started building a PANIC player, and somehow it turned into a Web app!  
This isn't intended to emulate the entire X68000. It's simply a convenient way to enjoy **PANIC** again. :)

**▶ [Panic Player Web — Browser player](https://layer812.github.io/PanicPlayerWeb/)** (GitHub Pages deployment is being prepared)

Choose a `.PAN` file from your own computer and play it in your browser. **Locally selected PAN files are processed in the browser and are not uploaded to a server.** The application has no persistent PAN-storage feature, although your browser may use its normal temporary cache.

There's also a sample: **[DENKO1.PAN](pan/DENKO1.PAN)**. You can select it from the player's PAN library.

Panic Player Web was developed based on [X68K Tab](https://github.com/Layer812/X68KTab5). See the related M5Stack Tab5 [panicplayer](https://github.com/Layer812/PanicPlayerTab5) as well.

## Using the player

1. Choose PAN files or a folder, or drag a file into the library.
2. Use **PLAY** to play with audio. **PREV/NEXT** switches tracks and begins playback.
3. **REPEAT** loops the same track. **FOLDER AUTO** plays the library sequentially and wraps to the start.
4. Open the collapsible playback diagnostics only if needed.

Files from this repository's `main/pan/` are listed by name and fetched only after playback is requested. Arbitrary URL playback and shared PAN URLs are not supported.

## Building from source

Panic Player Web uses the authentic **PANIC.X V1.38** running in a real **Musashi Motorola 68000** emulator.

Requirements:

- Python 3, Node.js 20+, Emscripten (`emcc`)
- The authorized [X68K Tab](https://github.com/Layer812/X68KTab5) source tree containing Musashi and `src/panic_x_bin.c`, or equivalent lawfully obtained source material

Windows development command:

```bat
py -3 tools\START_PLAY.py --source "G:\X68KTab5" --pan "G:\MyPAN\example.PAN"
```

**Publication status:** README, license materials and the Web HTML shell have been published first. The full FIX38 emulator/JS source, build scripts and tests are prepared for publication but **have not yet all been committed to GitHub**. The command above will work after the remaining source is published. Precompiled CPU WASM and PANIC.X are not bundled here.

The planned repository layout retains `tools/` for builds, `tests/` for regression testing, and `docs/` for development/source reference material. Only files needed to run the Web app should be deployed to GitHub Pages.

## Copyright and acknowledgments

- **Original Panic Player Web code:** © 2026 Layer812
- **PANIC / PANIC.X:** original author and copyright holder **Hideya Nagata (pako)**; V1.38 revisions by **Nashimi**; original documentation controls
- **Musashi:** © Karl Stenerud and contributors, MIT License
- **PX68K / WinX68k / xkeropi:** thanks to their authors, maintainers and documentation contributors
- **Individual .PAN works:** graphics, audio, music and animation rights remain with their authors and other rights holders
- **SHARP X68000:** names and trademarks belong to SHARP and the relevant rights holders. This is an unofficial independent project

**Permission to redistribute PANIC.X does not grant permission to redistribute individual PAN animations.** See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE_PANIC_X.txt](LICENSE_PANIC_X.txt), [PANIC_V1.38_NOTICE.txt](PANIC_V1.38_NOTICE.txt) and the original [PanicPlayerTab5 PANIC documentation](https://github.com/Layer812/PanicPlayerTab5/tree/main/docs).

The repository MIT license applies **only to new material owned by Layer812**. It does not relicense third-party code, binaries or PAN files.

Thanks to everyone who created, preserved and shared X68000/PANIC culture.
