// Pause the foreground-only PAN guest while the browser tab is hidden.
// Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
// A hidden page is NOT a queue of animation frames to replay later.
// Do not advance guest instructions while hidden. On restoration the caller
// reanchors the guest wall-clock limiter without changing guest CPU cycles.
export function createForegroundVisibilityGate({
  doc=globalThis.document, onResume=()=>{},
}={}) {
  const isHidden=()=>doc?.hidden===true || doc?.visibilityState==='hidden';
  const pending=new Set();
  let started=false,wasHidden=false;
  const notify=()=>{
    if(isHidden()){wasHidden=true;return;}
    const resumed=wasHidden;
    wasHidden=false;
    if(resumed && started) onResume();
    for(const done of pending){pending.delete(done);done();}
  };
  return {
    isHidden,
    start(){
      if(started)return;
      started=true;
      wasHidden=isHidden();
      doc?.addEventListener?.('visibilitychange',notify);
    },
    waitUntilVisible(){
      if(!started || !isHidden())return Promise.resolve();
      return new Promise(resolve=>pending.add(resolve));
    },
    stop(){
      if(!started)return;
      started=false;
      doc?.removeEventListener?.('visibilitychange',notify);
      wasHidden=false;
      // STOP and dispose must never leave a hidden-tab wait unresolved.
      for(const done of pending){pending.delete(done);done();}
    },
  };
}
