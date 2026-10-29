# Panic Player Web — Third-party notices / 著作権・謝辞

This is an attribution index, not a replacement for original permission/license documents. **Original source notices and terms take precedence.**

### Panic Player Web
Original Web GUI, host integration and new adapters: © 2026 Layer812. The repository MIT [LICENSE](LICENSE) applies **only** to the newly authored parts owned by Layer812.

### PANIC / panic.x V1.38
Original author/copyright holder: **Hideya Nagata (pako / ぱこたん / 永田英哉)**. V1.38 includes modifications by **Nashimi (なしみ)**. The original author permitted broad use, copying, redistribution and modification, including commercial uses; the original document remains authoritative. See [PANIC source documentation](https://github.com/Layer812/PanicPlayerTab5/tree/main/docs), [PANIC release archive](http://retropc.net/x68000/software/movie/panic/panic/), [PANIC license summary](LICENSE_PANIC_X.txt) and [V1.38 notice](PANIC_V1.38_NOTICE.txt).

**Individual .PAN animation files have separate copyrights and permissions, including images, sound and music.** Rights to distribute PANIC.X do not grant rights to distribute other authors' PAN files.

### Musashi 680x0
© Karl Stenerud and contributors, MIT License. [Musashi upstream](https://github.com/kstenerud/Musashi). Preserve the original MIT copyright and license text when bundling Musashi source or a CPU build. This source repository does not include the original Musashi source or its generated CPU WASM.

### PX68K, WinX68k and xkeropi
Thanks to hissorii, kenyahiro, the WinX68k/keropi team, NONAKA Kimihiro and all contributors, porters and hardware documenters. [PX68K](https://github.com/hissorii/px68k) and [X68K Tab's detailed notices](https://github.com/Layer812/X68KTab5/blob/main/THIRD_PARTY_NOTICES.md). PX68K's inherited modules may have different per-file licenses; do not replace them with a blanket license.

### SHARP X68000 / system software
SHARP, X68000 and related names and programs are associated with SHARP and their respective rights holders. No original SHARP ROM dump, Human68k image or proprietary system software is included in this source release. See the [historical SHARP/FSHARP distribution conditions](https://github.com/Layer812/X68KTab5/blob/main/LICENSE_SHARP_X68000.txt) when those programs are involved.

### YM2151 FM core — ymfm
The browser YM2151 FM wave generator is derived from Aaron Giles' [ymfm](https://github.com/aaronsgiles/ymfm), fixed to commit `81aec25ccbb98f4873a255f7551ac4dadac59b4a`, under the BSD 3-Clause License. The original copyright, conditions, and full warranty disclaimer are shipped alongside the published WASM at [legal/ymfm_LICENSE.txt](legal/ymfm_LICENSE.txt). New glue/wrappers are independently authored. The original upstream is not affiliated with or endorsing Panic Player Web.

### Z-MUSIC SYSTEM v2.08
The original X68000 resident FM driver **Z-MUSIC SYSTEM v2.08 / ZMUSIC208.X** was created by **Zenji Nishikawa / 西川善司**. The original work and its copyright remain with the author. The original author's rights statement is documented in [kg68k/zmusic2](https://github.com/kg68k/zmusic2#license) with source references to `ZM1.MAN` / `ZMVER_UP.DOC`; the publisher's permission applies to the original software and is distinct from the [toyoshim/z-music.js](https://github.com/toyoshim/z-music.js) BSD-3-Clause host port (© Takashi Toyoshima).

The site does **not bundle** `ZMUSIC208.X` or incorporate its binary in the WebAssembly file. Each browser obtains the exact pinned original from `toyoshim/z-music.js` and verifies the fixed Git blob before guest execution. The user supplies local PAN works or selects a published PAN sample.

### Individual PAN animations
Each creator and other rights holder retains the copyright to animations, images, music and related material. Publish only specifically authorized works in `pan/`.

Panic Player Web is an independent unofficial project, not endorsed or sponsored by SHARP, M5Stack or any other rights holder.

Thank you to everyone who created, maintained and preserved the original X68000/PANIC culture.
