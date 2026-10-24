// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** Real time 68000 cycle pacing. Never synthesize PAN frames or skip guest instructions.
 * All virtual events still use actual m68k_execute() returned cycle counts.
 * Wall-clock pacing is independent of the approximate X68000 raster model.
 */
export const EMULATED_68000_HZ = 16_000_000;
export function makeGuestClockLimiter({
  now=()=>performance.now(),
  sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms)),
  cpuHz=EMULATED_68000_HZ,
  maxAheadMs=0.5,
  maxBehindMs=3, // retained only for call-site compatibility; never re-anchor
  sleepChunkMs=12,
  minHostSleepMs=6,
}={}) {
  if (!(cpuHz>0 && maxAheadMs>=0 && maxBehindMs>=0 && sleepChunkMs>0 && minHostSleepMs>0))
    throw new RangeError('invalid real-time CPU clock parameters');
  let originWallMs=0, sessionStartWallMs=0, previousCycles=0, elapsedCycles=0, started=false;
  let sleptMs=0, sleepCalls=0, resyncs=0, totalLateMs=0, peakLateMs=0;
  const currentCycles = cycles => cycles >>> 0;
  const guestMs = ()=> elapsedCycles * 1000 / cpuHz;
  return {
    reset(cycles=0){
      previousCycles=currentCycles(cycles);elapsedCycles=0;
      originWallMs=now();sessionStartWallMs=originWallMs;
      started=true;sleptMs=0;sleepCalls=0;resyncs=0;totalLateMs=0;peakLateMs=0;
    },
    // Elapsed time in external file I/O is not 68000 CPU execution time.
    // Pause virtual time without fast-forwarding during host operations.
    resume(){if(started)originWallMs=now()-guestMs();},
    async pace(cycles,shouldContinue=()=>true){
      if (!started) this.reset(cycles);
      const next=currentCycles(cycles);
      const delta=(next-previousCycles)>>>0; // correctly handles 32-bit wrap
      previousCycles=next;
      elapsedCycles+=delta;
      // FIX32: the wall deadline is absolute. Never silently reset the clock
      // when a 4ms-clamped browser timer fires late: doing so slows the PAN.
      const late=this.lateMs();
      if (late>peakLateMs) peakLateMs=late;
      while (shouldContinue()) {
        const ahead=originWallMs+guestMs()-now();
        // Browsers clamp nested setTimeout(0..4ms) to roughly >=4ms.
        // Avoid micro-sleeps entirely. Permit a bounded lead until a useful
        // >=6ms sleep is possible, then coarsely pace against the deadline.
        if (ahead <= maxAheadMs+minHostSleepMs) break;
        const delay=Math.min(ahead-maxAheadMs,sleepChunkMs);
        const before=now();
        await sleep(delay);
        sleptMs+=Math.max(0,now()-before);
        sleepCalls++;
      }
    },
    // Positive means the guest is behind the real-time deadline.
    lateMs(){return started ? now()-originWallMs-guestMs():0;},
    stats(){return {virtualMs:guestMs(),wallMs:started?now()-originWallMs:0,
      realWallMs:started?now()-sessionStartWallMs:0,
      cycles:elapsedCycles,sleptMs,sleepCalls,resyncs,totalLateMs,peakLateMs,
      lateMs:this.lateMs()};},
  };
}
