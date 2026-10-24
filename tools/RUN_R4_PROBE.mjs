/* node tools/RUN_R4_PROBE.mjs /path/to/PANIC.X (after Musashi build) */
import fs from 'node:fs';
import {musashiProbe} from '../src/musashi-probe.mjs';
if(!process.argv[2]) {console.error('Usage: node tools/RUN_R4_PROBE.mjs /path/to/PANIC.X');process.exit(2);}
try {
  const input=new Uint8Array(fs.readFileSync(process.argv[2]));
  const result=await musashiProbe(input);
  console.log(JSON.stringify(result,null,2));
  if(result.trace?.[0]?.trap !==0xff4a ||result.trace?.[0]?.steps<7) process.exitCode=1;
} catch(e){console.error(e);process.exitCode=1;}
