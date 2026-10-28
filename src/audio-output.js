// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/* Small PCM queue, purposely not an emulated sound chip. The guest core owns timing. */
export class AudioOutput {
  constructor() { this.context=null; this.cursor=0; this.volume=1; this.sources=new Set(); }
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
  enqueue(interleaved, sampleRate, channels=2) {
    if (!this.context || this.context.state !== 'running') return false;
    if (!(interleaved instanceof Float32Array) || ![1,2].includes(channels) ||
        !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
        interleaved.length % channels !== 0) throw new Error('Invalid PCM chunk');
    const n = interleaved.length / channels;
    if (n === 0) return true;
    // Avoid runaway latency if browser tab is suspended or producer runs faster.
    if (this.cursor > this.context.currentTime + .5) return false;
    const buffer = this.context.createBuffer(channels, n, sampleRate);
    for (let channel=0; channel<channels; channel++) {
      const dest = buffer.getChannelData(channel);
      for (let i=0; i<n; i++) dest[i] = interleaved[i*channels+channel];
    }
    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.connect(this.context.destination);
    const start = Math.max(this.context.currentTime + .015, this.cursor);
    node.start(start);
    this.sources.add(node);
    node.onended=()=>this.sources.delete(node);
    this.cursor = start + n/sampleRate;
    return true;
  }
  halt() {
    for(const node of this.sources){try{node.stop();}catch{}}
    this.sources.clear();
    this.cursor=this.context?.currentTime??0;
  }
  async pause(){if(this.context?.state==='running')await this.context.suspend();}
  async resume(){if(this.context?.state==='suspended')await this.context.resume();}
  async stop() {
    this.halt();
    if (this.context) { await this.context.close(); this.context=null; }
    this.cursor = 0;
  }
}
