// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* Small PCM queue, purposely not an emulated sound chip. The guest core owns timing. */
export class AudioOutput {
  constructor() { this.context=null; this.cursor=0; this.streamCursors=new Map(); this.volume=1; this.sources=new Set(); this.sourceStreams=new Map(); this.guestAudioOrigin=null; }
  async enable() {
    this.context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === 'suspended') await this.context.resume();
    this.cursor = Math.max(this.cursor, this.context.currentTime);
  }
  async tryAutoplay(timeoutMs=800) {
    // A suspended AudioContext.resume() can remain pending until a gesture.
    // Try audible autoplay, but never stall video for that unresolved promise.
    let timer;
    try {
      const attempt=this.enable().then(()=>true,()=>false);
      await Promise.race([attempt,new Promise(resolve=>{
        timer=setTimeout(()=>resolve(false),timeoutMs);
      })]);
      return this.context?.state === 'running';
    } finally {clearTimeout(timer);}
  }
  // Set at actual PAN guest CPU START, never while waiting for .PAN fetch or
  // 68000 resident boot. Host AudioContext is the shared playback clock.
  beginGuestTimeline(){
    this.guestAudioOrigin=this.context?.state==='running'
      ?this.context.currentTime+.025:null;
  }
  enqueue(interleaved, sampleRate, channels=2, stream='default', guestSeconds=null) {
    if (!this.context || this.context.state !== 'running') return false;
    if (!(interleaved instanceof Float32Array) || ![1,2].includes(channels) ||
        !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
        interleaved.length % channels !== 0) throw new Error('Invalid PCM chunk');
    const n = interleaved.length / channels;
    if (n === 0) return true;
    // Avoid runaway latency if browser tab is suspended or producer runs faster.
    // Different guest sound devices share the AudioContext mixer but keep
    // independent schedules. Serializing FM after an ADPCM buffer produces
    // artificial silence and breaks their simultaneous playback.
    const streamCursor=stream==='default'?this.cursor:
      (this.streamCursors.get(stream)??this.context.currentTime);
    if (streamCursor > this.context.currentTime + .5) return false;
    const buffer = this.context.createBuffer(channels, n, sampleRate);
    for (let channel=0; channel<channels; channel++) {
      const dest = buffer.getChannelData(channel);
      for (let i=0; i<n; i++) dest[i] = interleaved[i*channels+channel];
    }
    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.connect(this.context.destination);
    let start = Math.max(this.context.currentTime + .015, streamCursor);
    if(Number.isFinite(guestSeconds) && guestSeconds>=0 && this.guestAudioOrigin!==null){
      const target=this.guestAudioOrigin+guestSeconds;
      // Protect against large scheduling drift if guest execution is slower
      // than the real device. Never invent skipped guest cycles or samples.
      start=Math.max(start,target);
    }
    if(start > this.context.currentTime + .5)return false;
    node.start(start);
    this.sources.add(node);
    this.sourceStreams.set(node,stream);
    node.onended=()=>{this.sources.delete(node);this.sourceStreams.delete(node);};
    if(stream==='default')this.cursor=start+n/sampleRate;
    else this.streamCursors.set(stream,start+n/sampleRate);
    return true;
  }
  halt(stream=null) {
    // ADPCM _ADPCMMOD stop must not terminate a simultaneously playing FM
    // voice. Explicit player STOP still halts all streams (stream=null).
    for(const node of this.sources){
      if(stream!==null && this.sourceStreams.get(node)!==stream)continue;
      try{node.stop();}catch{}
      this.sources.delete(node);this.sourceStreams.delete(node);
    }
    if(stream===null){this.streamCursors.clear();this.cursor=this.context?.currentTime??0;this.guestAudioOrigin=null;}
    else if(stream==='default')this.cursor=this.context?.currentTime??0;
    else this.streamCursors.delete(stream);
  }
  async pause(){if(this.context?.state==='running')await this.context.suspend();}
  async resume(){if(this.context?.state==='suspended')await this.context.resume();}
  async stop() {
    this.halt();
    if (this.context) { await this.context.close(); this.context=null; }
    this.cursor = 0;
  }
}
