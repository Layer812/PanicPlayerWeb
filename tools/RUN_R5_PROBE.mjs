/* Run only after a genuine Musashi build. Streaming path: no full PAN read. */
import fs from 'node:fs';
import {runR5Probe} from '../src/musashi-r5-probe.mjs';
if(process.argv.length!==4){
 console.error('Usage: node tools/RUN_R5_PROBE.mjs /path/to/PANIC.X /path/to/own.PAN');
 process.exit(2);
}
let file;
try {
 const hu=new Uint8Array(fs.readFileSync(process.argv[2]));
 file=await fs.promises.open(process.argv[3],'r');
 const stat=await file.stat();
 const pan={
   size:stat.size,
   slice(begin,end){
     return {async arrayBuffer(){
       const output=Buffer.alloc(end-begin);
       const {bytesRead}=await file.read(output,0,output.length,begin);
       return output.subarray(0,bytesRead).buffer.slice(output.byteOffset,output.byteOffset+bytesRead);
     }};
   }
 };
 const report=await runR5Probe(hu,pan);
 console.log(JSON.stringify(report,null,2));
} catch(e){console.error('R5 probe failed:',e);process.exitCode=1;}
finally {if(file)await file.close();}
