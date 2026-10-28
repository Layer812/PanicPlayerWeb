# Z-MUSIC v2: absent TRAP #3 crash fix

Issue: `denkozm.pan` SHA-256 `5e3df5bff5b5f7eb0c91bd4851c5577ad2b04c4e9bb335e321a01e26af060849`
was seen to stop at guest PC `$00058E76`, fault `$00FFFFF8`.

The original panicCreationKitForWin `x68/lib/zmusic.s` presence probe
loads the TRAP #3 vector from guest `$8C`; if it points below `$C00000`,
it subtracts 8 and checks for `ZmuSiC` immediately before the handler.

The PWP synthetic Human68k boot zeroed **all** vectors, including `$8C`.
A null vector minus eight becomes `$FFFFF8` on a 24-bit bus. This is a
bug in *guest boot vector initialization*, not a broken `.PAN` file.

The fix initializes uninstalled TRAP #3 to an *unmapped ROM-range target*
`$FF0000`. As in a Human68k system without Z-MUSIC, the actual guest
code takes the `not resident` branch without reading below address zero.
It cannot call an unimplemented driver, and a real Z-MUSIC driver can
replace vector 35 later. We **do not** write `ZmuSiC` or a dummy RTE
handler, nor fake a successful playback call.

This removes this particular crash, **but does not make Z-MUSIC resident
or produce Z-MUSIC music**. See Issue #8 for genuine driver bootstrap,
Human68k `_KEEPPR`, real TRAP #3, timers and YM2151 output.

Native mock test verifies the original guest branching condition, vector
replacement and reset; actual `denkozm.pan` replay is still unverified.
