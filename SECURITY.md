# Security / プライバシー

- Locally selected PAN files are not uploaded by the Web player.
- Arbitrary external URLs or PAN sharing URLs are not supported.
- GitHub's fixed `Layer812/PanicPlayerWeb/main/pan/` metadata may be checked on startup; media downloads occur only after PLAY/PREV/NEXT action.
- Downloads use no cookies/credentials and validate the PAN signature, size, and the expected Git blob SHA.
- Do not commit original PANIC.X, original Musashi binary builds, X68000 ROMs, Human68k disk images, private PAN data or access tokens.
- Only run files you trust. Emulated machine code is still untrusted input to the emulator.
