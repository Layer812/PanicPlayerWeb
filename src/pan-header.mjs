// Panic Player Web — Copyright (c) 2026 Layer812
// SPDX-License-Identifier: MIT (original Layer812-owned code only)
// Third-party components and .PAN media retain separate notices.
// PANIC container: word at +0x0A multiplied by two is the complete
// header length; big-endian long at +0x0C is payload length.  This is
// cross-validated with the two authentic supplied PANs; only observations
// are reported, never used to reject a guest-supported vintage PAN.
export function describePanHeader(first,fileSize){
  if(!(first instanceof Uint8Array)||first.length<16)return {summary:'先頭16バイト不足'};
  const magic=[0x50,0x41,0x4e,0x49,0x43,0x1a].every((v,i)=>first[i]===v);
  const u16=i=>(first[i]<<8)|first[i+1];
  const u32=i=>(first[i]*16777216 + (first[i+1]<<16)+(first[i+2]<<8)+first[i+3])>>>0;
  const version=u16(8),headerWords=u16(10),dataBytes=u32(12);
  const expectedBytes=headerWords*2+dataBytes;
  const sizeMatch=expectedBytes===fileSize;
  return {magic,version,headerWords,dataBytes,expectedBytes,sizeMatch,
    summary:`magic=${magic?'PANIC':'不一致'} / version=0x${version.toString(16).padStart(4,'0').toUpperCase()} / `+
     `header=${headerWords*2} B / payload=${dataBytes} B / `+
     `実サイズ=${fileSize} B / 長さ${sizeMatch?'一致':'不一致（原因未確定）'}`};
}
