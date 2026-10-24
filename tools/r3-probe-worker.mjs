import {runStartupProbe} from '../src/hu-startup-probe.mjs';
self.onmessage=async({data})=>{
  if(data?.type!=='boot' || !(data?.file instanceof File)) {
    self.postMessage({ok:false,error:'Expected an original PANIC.X file.'});return;
  }
  try{
    const [file,wasm]=await Promise.all([
      data.file.arrayBuffer(),fetch('../core/pwp_hu_boot.wasm').then(r=>{
        if(!r.ok)throw new Error(`WASM fetch failed: ${r.status}`);
        return r.arrayBuffer();
      })
    ]);
    const result=await runStartupProbe(new Uint8Array(file),wasm);
    self.postMessage({ok:result.success,result});
  }catch(e){self.postMessage({ok:false,error:String(e?.message??e)});}
};
