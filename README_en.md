# Panic Player Web

[日本語](README.md)

I wanted to revisit X68000 **PANIC** animations after many years. I started building a PANIC player, and somehow it turned into a Web app!  
This isn't intended to emulate the entire X68000. It's simply a convenient way to enjoy **PANIC** again. :)

**▶ [Panic Player Web — Browser player](https://layer812.github.io/PanicPlayerWeb/)**

Choose a `.PAN` file from your own computer and play it in your browser. **Locally selected PAN files are processed in the browser and are not uploaded to a server.** The application has no persistent PAN-storage feature, although your browser may use its normal temporary cache.

There's also a sample: **[DENKO1.PAN](pan/DENKO1.PAN)**. You can select it from the player's PAN library.

Panic Player Web was developed based on [X68K Tab](https://github.com/Layer812/X68KTab5). See the related M5Stack Tab5 [panicplayer](https://github.com/Layer812/PanicPlayerTab5) as well.

## Using the player

1. Choose PAN files or a folder, or drag a file into the library.
2. Use **PLAY** to play with audio. **PREV/NEXT** switches tracks and begins playback.
3. **REPEAT** loops the same track. **FOLDER AUTO** plays the library sequentially and wraps to the start.
   During playback, press **Space** to send a real SPACE key to PANIC.X. This advances media that wait for a SPACE keystroke.
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

## Tool used to create PAN works

Some PAN works were created with **[panicCreationKit](https://github.com/yagennankoz/panicCreationKit)** by **Nankotsu (yagennankoz)**, a toolkit for generating X68000 PANIC `.PAN` files from image sequences, video, and audio, including support for Z-MUSIC-based FM sound.

Many thanks to Nankotsu for making this creation toolkit available. This is an *authoring tool*, not a component bundled into the Panic Player playback engine.

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


## Z-MUSIC v2.08 / YM2151 FM (public release, October 29, 2026)

The public browser edition now runs authentic **Z-MUSIC SYSTEM v2.08** resident with original **PANIC.X V1.38** on the real **Musashi Motorola 68000**, including real guest TRAP #3, interrupt-driven YM2151 FM playback, and ADPCM support. It remains a lightweight PANIC movie player, not a general X68000 emulator.

- `denkozm.pan`: genuine Z-MUSIC-controlled YM2151 FM; browser listening and audio/video synchronization confirmed by a tester.
- `denkofm.pan`: direct YM2151 FM playback.
- `denkopcm.pan`: guest ADPCM decoding.

Press **PLAY** to unlock browser audio; autoplay may require a click. FM synthesis uses Aaron Giles' **ymfm** under BSD-3-Clause (license included in the published WASM site). Original Z-MUSIC is © **Zenji Nishikawa**. Its original executable is not bundled: the browser downloads exactly a fixed, hash-verified copy from a published third-party project when the player starts.

Source credits, original author notices, and licensing links are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). All PAN artworks and music remain the property of their authors.

## Denko (working title) — Comic

What if the activities surrounding Panic Player were a project of **Den-no Club (電脳倶楽部)**? This independent comic explores an imaginary world based on that premise.

**Episodes -1 through 5** are available; **6 through 8** are planned.

The **“FM音源で歌うPanic” (FM-singing PANIC)** featured throughout the comic can also be played in your browser: **[Play FM音源で歌うPanic](https://layer812.github.io/PanicPlayerWeb/?pan=DENKOSN)**.

Click a thumbnail to open its full-size comic page. The images are shared from the related [PanicPlayerTab5](https://github.com/Layer812/PanicPlayerTab5) repository.

*This is a fictional independent project, not an official Den-no Club publication.*

<table>
<tr>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko-1.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko-1.png" alt="Denko (working title) comic episode -1" width="185"></a><p><strong>-1</strong></p></td>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko0.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko0.png" alt="Denko (working title) comic episode 0" width="185"></a><p><strong>0</strong></p></td>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko1.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko1.png" alt="Denko (working title) comic episode 1" width="185"></a><p><strong>1</strong></p></td>
</tr>
<tr>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko2.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko2.png" alt="Denko (working title) comic episode 2" width="185"></a><p><strong>2</strong></p></td>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko3.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko3.png" alt="Denko (working title) comic episode 3" width="185"></a><p><strong>3</strong></p></td>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko4.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko4.png" alt="Denko (working title) comic episode 4" width="185"></a><p><strong>4</strong></p></td>
</tr>
<tr>
  <td align="center" width="33%"><a href="https://github.com/Layer812/PanicPlayerTab5/blob/main/denko5.png"><img src="https://raw.githubusercontent.com/Layer812/PanicPlayerTab5/main/denko5.png" alt="Denko (working title) comic episode 5" width="185"></a><p><strong>5</strong></p></td>
  <td></td>
  <td></td>
</tr>
</table>

The comic pages are separate creative works; PANIC.X and individual .PAN distribution terms do not automatically apply to them.
