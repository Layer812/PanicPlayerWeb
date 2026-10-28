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
