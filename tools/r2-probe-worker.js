import {createWasmGuestFile} from '../src/wasm-guestfs.js';
self.onmessage = async (event) => {
  try {
    if (typeof FileReaderSync === 'undefined') throw new Error('FileReaderSync unavailable');
    const fs=await createWasmGuestFile(event.data.file);
    const a=Array.from(fs.readAt(1,3));
    const b=Array.from(fs.readAt(4,8));
    const end=Array.from(fs.readAt(999,5));
    if (JSON.stringify(a) !== '[17,18,19]' || JSON.stringify(b) !== '[20]' || end.length) throw new Error('WASM byte mismatch');
    fs.close();
    self.postMessage({ok:true,message:'PASS: browser Worker → FileReaderSync → native WASM guestfs → PAN data bytes'});
  } catch (e) {
    self.postMessage({ok:false,message:`FAIL: ${e?.stack ?? String(e)}`});
  }
};
