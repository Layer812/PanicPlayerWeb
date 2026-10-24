// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
export class VideoOutput {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', {alpha: false, desynchronized:true});
    if (!this.context) throw new Error('Canvas 2D API unavailable');
    this.imageData = null;
  }

  // Future core must provide RGBA8888 tightly packed in row-major order.
  frame(width, height, rgba) {
    if (!Number.isInteger(width) || width<1 || width>2048 ||
        !Number.isInteger(height) || height<1 || height>2048) {
      throw new RangeError('Invalid frame dimensions');
    }
    if (!(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray) || rgba.byteLength !== width * height * 4) {
      throw new Error('Invalid RGBA8888 frame payload');
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
      this.imageData = null;
    }
    if (!this.imageData) this.imageData = this.context.createImageData(width,height);
    this.imageData.data.set(rgba);
    this.context.putImageData(this.imageData, 0, 0);
  }

  blank() {
    this.context.fillStyle = '#000';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
