# Z-MUSIC v2 actual-resident integration — implementation status

This is a genuine-loader foundation, **not** a released or resident Z-MUSIC emulator.

* Added `core/pwp_hu_resident.c/.h`: bounds-checked Human68k HU .X loader
  with base-address delta relocations (word, long and extended displacement),
  BSS zeroing and zero guest-memory modifications on validation failure.
* Added a read-only check of the actual guest vector at `$00008C`, the
  `ZmuSiC` signature immediately preceding its handler, and a v2 version.
  This check never installs a signature, trap handler or a fake resident.
* Existing `core/pwp_musashi.c`, PANIC.X, direct OPM, ADPCM, G1 display and
  GitHub Pages output paths remain unchanged.

**Next prerequisites for true residency:** a hash-pinned, legally reviewed
`ZMUSIC.X`; a two-process Human68k bootstrap with _EXEC and _KEEPPR; memory
blocks preserved across driver startup and PANIC.X launch; IOCS service
coverage for `_B_INTVCS`, `_OPMINTST`, `_B_SUPER`, timers and FM output.
The actual Z-MUSIC TRAP #3 handler must execute with 68000 emulation; no
Z-MUSIC signature or successful API response may be fabricated.

References:
* https://github.com/kg68k/zmusic2 (original Z-MUSIC v2.08 by Z. Nishikawa)
* https://github.com/yagennankoz/panicCreationKitForWin
* https://github.com/Layer812/PanicPlayerWeb/issues/8

This change intentionally does not package a third-party executable, alter
production guest launch or claim `denkozm.pan` is playable.
