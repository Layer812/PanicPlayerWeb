/** Genuine WASM RGBA -> PNG evidence; no synthetic pixels or CANVAS rendering.
 * Node-only helper (not loaded in browser). 512x512 byte buffer is passed
 * unchanged from pwp_frame_render. Output is PNG with filter type 0 per row.
 */
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';

const PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE=Uint32Array.from({length:256},(_,j)=>{
 let c=j;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;
});
const crc32=data=>{let c=0xffffffff;for(const b of data)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,data){
 const label=Buffer.from(type,'ascii');const n=Buffer.alloc(4);n.writeUInt32BE(data.length);
 const payload=Buffer.concat([label,data]);const chk=Buffer.alloc(4);chk.writeUInt32BE(crc32(payload));
 return Buffer.concat([n,payload,chk]);
}
export function pngFromRGBA(rgba,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>512||height>512 ||
    width*height*4!==rgba?.length)throw Error('Invalid actual-WASM RGBA frame dimensions');
 const src=Buffer.from(rgba);const row=width*4;const raw=Buffer.alloc(height*(row+1));
 for(let y=0;y<height;y++)src.copy(raw,y*(row+1)+1,y*row,(y+1)*row);
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const compressed=deflateSync(raw,{level:6});
 return Buffer.concat([PNG,chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',Buffer.alloc(0))]);
}
export function frameStats(rgba){
 if(!(rgba instanceof Uint8Array)||rgba.length%4)throw Error('Frame buffer not RGBA');
 let nonblack=0,minX=512,minY=512,maxX=-1,maxY=-1,changedRGB=0;
 const width=Math.round(Math.sqrt(rgba.length/4));
 for(let i=0;i<rgba.length;i+=4){
   if(rgba[i]||rgba[i+1]||rgba[i+2]){
     nonblack++;const p=i/4,x=p%width,y=Math.floor(p/width);
     if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;
   }
 }
 return {nonBlackPixels:nonblack,bounds:nonblack?{left:minX,top:minY,right:maxX,bottom:maxY}:null,
   rgbaSHA256:createHash('sha256').update(rgba).digest('hex')};
}
export function saveActualFrame(path,rgba,width,height){
 const stats=frameStats(rgba);
 if(!stats.nonBlackPixels)throw Error('Black-only RGBA image cannot be first visible evidence');
 const png=pngFromRGBA(rgba,width,height);
 writeFileSync(path,png,{flag:'wx'});
 return {...stats,pngBytes:png.length,pngSHA256:createHash('sha256').update(png).digest('hex')};
}
