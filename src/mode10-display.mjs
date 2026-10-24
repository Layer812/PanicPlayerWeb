// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
/** X68000 VC graphics slots: 4 physical nibble planes form two 8-bit layers. */
export function mode10GraphicsSlots(vctrlR1,vctrlR2){
 for(const v of [vctrlR1,vctrlR2])
   if(!Number.isInteger(v)||v<0||v>0xffff)throw new RangeError('Invalid X68000 VC register');
 const slots=[];
 for(let rank=0;rank<4;rank++){
   if(vctrlR2&(1<<rank))slots.push({rank,page:(vctrlR1>>(rank*2))&3});
 }
 return slots;
}
export function mode10GraphicsLayers(vctrlR1,vctrlR2){
 for(const v of [vctrlR1,vctrlR2])
   if(!Number.isInteger(v)||v<0||v>0xffff)throw new RangeError('Invalid X68000 VC register');
 const physical = [0,2,4,6].map(shift=>(vctrlR1>>shift)&3);
 return [
   {layer:0,enabled:!!(vctrlR2&3),lowPage:physical[0],highPage:physical[1]},
   {layer:1,enabled:!!(vctrlR2&12),lowPage:physical[2],highPage:physical[3]}
 ];
}
// Legacy query: report one logical 256-colour layer, never a physical nibble.
export function mode10DisplayPage(vctrlR2,vctrlR1=0xe4){
 const a=mode10GraphicsLayers(vctrlR1,vctrlR2).filter(x=>x.enabled);
 return a.length===1?a[0].layer:null;
}
