# Z-MUSIC 2.08: R12 experimental real-CPU TSR preboot

Status: **CPU boot prototype; NOT resident production driver or audio playback**.

## What runs
With `--experimental-zmusic` only, the real pinned Tab5-derived Musashi
runs a second HU/X guest at `$240000` in the same 4 MiB RAM as PANIC.X.
The original PANIC.X CPU context is saved, a separate bounded process memory
control block is created, and the real 68000 program runs until DOS/IOCS.

The experimental guest can register genuine interrupt vectors via IOCS
`_B_INTVCS` and allocate bounded guest-only memory. On actual guest
`DOS _KEEPPR`, the loader requires the *real guest* to have installed a
valid TRAP #3 vector and 2.xx `ZmuSiC` identifier; only then are driver RAM,
vector and allocations preserved and the original PANIC.X CPU context
restored. No magic marker, trap handler or music is injected by the host.

A synthetic test program executes MOVEQ/MOVEA/TRAP #15 and _KEEPPR on
actual Musashi WASM and checks the real guest vector, CPU restoration and
continued execution of PANIC.X.

## Real ZMUSIC208.X evidence
CI independently fetches the 56,310-byte authentic ZMUSIC208.X from
`toyoshim/z-music.js` pinned Git commit
`fd6ad1c1db9edcf973283597e2c95cedf17eb701` and Git blob
`4a4d88b3a620694cad3f27739e5b6a4d70cfbbbf`.
The actual 68000 program is loaded with the strict HU relocation engine
and stepped to its first unsupported/implemented service boundary.

The current minimal Human68k adapter is expected to lack DOS/IOCS services
needed by the real Z-MUSIC driver (_OPMINTST, timers, _B_SUPER, etc.).
The output records exact guest PC, intercepted call, status and fault,
**never** calls this a full Z-MUSIC boot pass on an unsupported call.

No Z-MUSIC executable or third-party sound core is committed or deployed.
The experimental code is behind `PWP_EXPERIMENTAL_ZM2` and is absent from
the default Pages Emscripten build. The experimental artifact is kept
inside a temporary build directory, never written to the deployed `core/`.

References:
- https://github.com/kg68k/zmusic2 — original Z-MUSIC v2.08 sources
- https://github.com/toyoshim/z-music.js — existing real driver web port
- https://github.com/yagennankoz/panicCreationKitForWin — guest `zm_chk`
- https://github.com/Layer812/PanicPlayerWeb/issues/8 — remaining requirements

**Not yet delivered**: real ZMUSIC208.X successful _KEEPPR on the same
guest CPU, YM2151 timer interrupt/OPM sound output, `denkozm.pan` BGM.

## R13 _FNTGET actual boot continuation

CI's first real ZMUSIC208.X run stopped at IOCS `$19 _FNTGET`, PC
`$2478C2`, after 1,656 guest cycles; the prior synthetic-only PASS was
insufficient. The experimental CPU now implements the **documented**
8x16/16x16 format for six X68000 user-defined gaiji codes
`$7670-$7675`: 4-byte width/height header plus 32-byte bitmap,
starting from the physically correct blank user-defined glyph bank.
This is a genuine IOCS buffer response, not fake Z-MUSIC residency.

The real driver acceptance now requires advancing beyond this blocked IOCS
service. An ordered trace records each actual IOCS/DOS call, and unimplemented
ones remain blocked until compatible semantics exist. Production Pages does
not compile this experimental code.

## R14 DOS _VERNUM continuation

Real-driver CI successfully executes all six original _FNTGET calls, then
stops at `PC=$24C5DC` / DOS `$FF30 _VERNUM` (3,882 guest cycles).
The experimental loader now supplies the Human68k 3.02-compatible version
`$36380302` on that OS query, matching the independent real Z-MUSIC web port.
This is a **virtual OS version**, NOT a fabricated driver-resident report.
CI requires passage beyond the version call with authentic ZMUSIC208.X.

## R15 DOS _BUS_ERR memory probe

After _VERNUM the actual driver next calls `DOS $FFF7 _BUS_ERR`, PC
`$24C530` (4,206 guest cycles). The isolated adapter now implements the
real Human68k convention of SIZE.w 1/2/4 with P1/P2 source and destination
pointers from the guest stack: validates both ranges and alignment, copies
only mapped guest RAM bytes, returns 0 only for a valid access, and returns
an address error on an invalid mapping. Unknown MMIO (such as an absent
MIDI expansion board) is **not** assumed present. CI now requires the real
program to pass this service, and records the actual arguments.

## R16 DOS _GETPDB continuation

Actual ZMUSIC208.X probed uninstalled MIDI hardware at `$EAFA07`/
`$EAFA05` with DOS _BUS_ERR (size 1), correctly took the *no MIDI board*
branch, and ran 2,901,376 guest cycles before `$FF81 _GETPDB` at
`PC=$24111A`. The isolated virtual Human68k now returns the genuine
process address `$240000` for both _GETPDB aliases `$FF81/$FF51`.
No fake resident marker is installed and Pages stays unchanged.

## R17 actual PSP + environment memory correction

After _GETPDB, the first prototype returned `$240000` (HU program code)
**as if it were a Human68k process descriptor**. The authentic driver then
faulted at `$FFFFF8` near PC `$24C618`. The isolated boot now creates
an independent, bounded 256-byte PDB at `$23FD00` and a real empty
Human68k environment block at `$23FC00` (first 4 bytes are header;
strings begin at offset +4). _GETPDB returns the PDB address and
`PDB[0]` contains the environment pointer, matching Z-MUSIC's actual
`search_env` routine. These regions do not overlap PANIC.X or ZMUSIC.X.

## R18 genuine Z-MUSIC's PCM8 detection at vector $88

The corrected PDB and empty environment were valid, yet the actual CPU
still faulted at `PC=$24C618`, physical `$FFFFF8`. Inspecting the
original source around `set_patch` shows why: `movea.l $88.w,a0;
move.l -8(a0),d0` checks whether PCM8 is resident **without first
checking for a null vector**. R11 only initialized TRAP #3 ($8C), not
TRAP #2 ($88). In isolated experimental preboot, both uninstalled
TRAP vectors now point to separate guest-RAM default handlers ($408/$418)
whose preceding bytes do NOT have the `PCM ` or `ZmuSiC` signature.
The handler instruction is ILLEGAL (fail closed if invoked), not a fake
PCM8/Z-MUSIC service. A real guest's _B_INTVCS later replaces TRAP #3.
The default public Pages boot stays untouched.

## R19 authentic DOS _FPUTS console output

With safe uninstalled PCM8/TRAP #2 and TRAP #3 guest vectors, the authentic
Z-MUSIC driver passed _GETPDB and an actual mapped-RAM _BUS_ERR check,
reaching `DOS $FF1E _FPUTS` at `PC=$247A5C`, 2,904,402 cycles.
The isolated runtime now implements _FPUTS using the actual guest string,
only stdout/stderr handles, strict RAM/NUL validation, and the existing
bounded Human68k console buffer. No invented text or driver status.
CI requires an additional real guest service beyond this call.

## R20 minimal IPL default vectors and NUL character device

The authentic ZMUSIC208.X reported `MUSIC BIOS has already been included
in your system.` after returning from DOS _FPUTS, then requested IOCS
`_B_SUPER`. The prior synthetic RAM-based TRAP defaults were incorrectly
being treated as preexisting drivers because they were below `$C00000`.
Experimental boot now places absent TRAP2/TRAP3 vectors in IPL ROM at
`$FF0000`, implements a read-only minimal IPL signature window
`$FEFFF0..$FF001F`, and leaves invalid ROM execution fail-closed.
The real Human68k NUL device-chain node at `$6810` is installed with
attribute `$8024`, name `NUL     `, and end-of-list pointer `-1`;
this is a system device, **not** Z-MUSIC residency. IOCS _B_SUPER now
uses the actual 68000 SR, USP and ISP banks. Pages production remains
unmodified.

## R21 unclaimed MIDI/IOCS vectors and OPM ISR registration

After the virtual IPL and NUL device fixes, genuine ZMUSIC208.X still
printed `MUSIC BIOS has already been included in your system.` and exited
without invoking IOCS _B_INTVCS. Original `set_vect` checks the MIDI
receive vector at `$228`; zero falsely indicates the interrupt has
already been occupied. Initializing uninstalled MFP/IOCS vectors to their
readable ROM-range default (`$FF0000`) lets the actual guest distinguish
unclaimed hardware from a resident handler. Added ROM defaults for the
MIDI RX vector `$228`, ADPCM stop vector `$1A8`, and IOCS `$1F0`,
`$160`, `$167`. IOCS `_OPMINTST` now saves the real guest ISR pointer
with range validation, without manufacturing timer events or FM audio.

## R22 root cause of initial MUSIC BIOS false positive

Original Z-MUSIC v2.08 `set_vect` starts by loading `a2=$FE0000` and
comparing this threshold with the **MFP FM interrupt vector at `$10C`**
(`cmp.l $10c.w,a2; bcs set_opmv; otherwise return D0=-1`). The minimal
virtual OS had left this vector 0, so `set_vect` returned `-1` before
any IOCS call and printed `MUSIC BIOS has already been included ...`.
The earlier $228 MIDI default alone did not address this first check.
The experimental guest now initializes `$10C` to the unmapped IPL ROM
vector `$FF0000`; original guest code will determine whether to invoke
IOCS `_OPMINTST` and `_B_INTVCS` rather than being forced through.

## R23 actual 16x16 gaiji restoration

Original Z-MUSIC reached IOCS `$0F _DEFCHR` at guest PC `$24CB24`
after it successfully installed five IOCS/OPM vectors. This call is
used by the original `do_gj` subroutine to restore six 32-byte glyph
bitmaps, and can precede either success or an error message. The
isolated 68000 adapter now validates the actual `D1=$00087670..7675`,
`A1` 32-byte bitmap and writes the guest's pixels into a bounded
gaiji bank; it does not fake the result of `_KEEPPR`. CI must
advance to a subsequent genuine DOS/IOCS boundary before PASS.

## R24 MFP H-SYNC timing during resident bootstrap

Original Z-MUSIC calls `init_midibd` and a handful of other routines
using the X68000's H-SYNC and V-DISP wait loops. The production
minimal MFP bus held GPIP bit7 high; no real 68000 program can pass
`h_wait` with a fixed H-SYNC level. This experimentally models the
real 15.75 kHz H-SYNC on GPIP bit7 using elapsed 16 MHz *guest cycles*,
preserving all other MFP bits, solely while the real driver preboots.
The regular Pages runtime is unchanged. The authentic driver test also
records the total elapsed cycles after the final interrupted call.

## R25 real 8255 joystick input ports A/B

Real ZMUSIC208.X passed the H-SYNC wait; next bus access at
`$E9A001` failed (PC `$2484E0`, guest cycles 2,911,467).
The X68000 8255 port A and B are read-only joystick input latches
at `$E9A001/$E9A003`. With no buttons pressed, all active-low input
lines read high (`$FF`). The experimental guest bus now permits
these **read-only**, neutral-port reads; it still does not fabricate
joystick presses or accept unsupported writes.

## R26 authentic IOCS _DMAMOVE copied voice table

With read-only PPI port A/B, authentic ZMUSIC208.X proceeds to the
original `trans_dma` at `PC=$247766`, IOCS `$8A _DMAMOVE`.
The isolated virtual DMA engine now executes **actual guest RAM byte
copies** for mode `$05` (A1++ source, A2++ destination) and up to
`$FF00` bytes, with both pointers/length checked before modification.
Other DMA modes and MMIO transfers remain unsupported; no fake success.
The CI proof must pass this first native DMA service and show its real
D1/D2/A1/A2 registers and next service or full _KEEPPR.

## R27 overlap-correct DMA and experimental YM register write staging

Real ZMUSIC208.X invokes _DMAMOVE mode 5, 10945 bytes, src=$257036,
dest=$25706D, intentionally copying forward through an overlapping
voice table. The implementation now uses sequential DMA A1++ -> A2++
bytes, not memmove's reverse copy. The next guest access was an OPM
$E90003 write, so the *experimental build only* now records each real
YM2151 register write and busy timing. This is not an audible FM core,
and no production change or music success is claimed. Real-driver CPU
errors now fail the CI gate even after sufficient calls were observed.

## R28 genuine ADPCM initialization data path

With experimental YM2151 register writes, the original ZMUSIC208.X
reached IOCS `$60 _ADPCMOUT` at guest PC `$247A1E`, cycle 3,259,476.
The original `init_all` issues `D1=$0403`, `D2=32`, `A1=dummy_data`
and expects a real ADPCM DMA transfer. This experimental preboot
supports **only that exact verified initialization shape**, feeding the
guest's original 32 bytes through the existing bounded MSM6258 PLAY,
DATA and RESET MMIO/FIFO hardware state. Arbitrary _ADPCMOUT requests
remain unsupported. Real DMA DRQ timing and FM synthesis are still
separate requirements for playback.

## R29 gate: real _KEEPPR and post-resident TRAP #3 status call

The authentic 56,310-byte ZMUSIC208.X completed DOS `$FF31 _KEEPPR`
at PC `$2478A2` after 49 intercepted DOS/IOCS calls. The original
PANIC guest context was restored to `PC=$10000` with driver handler
vector $8C and real `ZmuSiC` v2 signature preserved in RAM.

The acceptance test now starts a separate **real 68000 guest** consisting
of `MOVEQ #$50,D1; TRAP #3; DOS _EXIT2`, invoking the original driver's
`zm_status` command. It requires the real handler and an A0 status-work
pointer inside the retained driver memory, then successful guest exit.
No synthetic TRAP callback, fake identification or host-invented status.
Only actual driver residency + real API execution can pass the CI gate.
