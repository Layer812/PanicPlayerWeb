# Panic Player Web R16 FIX36 — VC R1 layer priority / visibility evidence

## FIX35 actual JSON evidence: cha_ed.PAN

- PAN size 979,386 and header length match. CPU effective 16.25MHz against 16MHz target, 0 resyncs, 78 distinct visible outputs, guest ongoing.
- VC R1=$244E, VC R2=$007F, CRT mode 10; V-DISP/IRQ 836/836.
- CYNTHIA SON/DISP both enabled but **0 active/raw sprites, 0 PCG/BG bytes**; 2,048 sprite attribute bytes are not a proof that there are any actual sprites. Further _SP_ON gate changes are not supported by this evidence.
- Graphics palette G[0], G[1], G[255] are zero *at the sample time*. This does NOT establish that all 256 entries are zero, nor whether those entries were intentionally programmed black.
- Therefore character disappearance is not identified as a CYNTHIA drawing failure. Investigate graphic/TEXT layer overlap, palette indexes and explicit VCtrl priorities.

## Source changes

- Real video controller R1 high-byte priorities decoded as G=(R1>>8)&3, TEXT=(R1>>10)&3, BG=(R1>>12)&3. Numerically lower priority values are above higher ones, with TEXT over BG and BG over G for ties. FIX35's hardcoded TEXT-always-over-G order ignored this hardware register. Reference: original PX68K `windraw.c` `grp_pri`, `text_pri`, `bg_pri`, and final compositor.
- Preserve R1 low-byte graphic physical page pair selection, R2 layer enable bits and original guest CRTC scroll. Zero index remains transparent *where appropriate for layering*. Never infer or synthesize a character image.
- Read-only, last-rendered-frame observations: actual nonzero graphic indexes, nonzero TEXT indexes, overlapping pixels, graphic/text contributions and nonzero graphic indexes whose exact graphics palette word currently equals zero. The last figure is explicitly a PALETTE VALUE test, NOT evidence that a color was never written.
- Existing FIX32 16MHz event-deadline clock, audio, MFP V-DISP and palette0 evidence compensation are unchanged.

## Verification

- Native C real guest-memory video-bus + compositor tests: G on top of TEXT, TEXT on top of G, zero graphic index transparency, zero graphic palette detection.
- The old FIX35 and new FIX36 generate identical RGB output hashes for a representative graphics-only mode10/scroll case, which protects the D17SLOW-like path (not proof of playback of an actual user PAN).
- Node and pytest suites pass; source-only Emscripten Musashi WASM was **not built nor run in this Linux environment**. On Windows the existing START_PANIC_PLAYER launcher uses source fingerprinting to request a fresh, actual Musashi build.

**Limitations:** We do not have `cha_ed.PAN` or `nk_harmo.PAN` bytes in this environment, only the supplied diagnostics. Thus there is no claim that this fixes the specific character image. Depending on where the real PAN draws its picture, more work may be needed (e.g., blank graphic palette, mode10 video special effects, missing text-page behavior). On FIX36 the enhanced JSON is designed to establish that from observable guest state rather than guesses. The separately known D17SLOW CPU_STOP -8 is unresolved and not modified.

No original PAN files, movies, original Tab5 project files or user-supplied art are included or modified.
