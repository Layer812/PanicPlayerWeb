#!/usr/bin/env python3
"""Read-only Tab5 source -> real native Musashi gate -> real WASM gate.

Writes one self-contained result ZIP to G:\\ (on Windows), including failures.
Never changes the supplied X68KTab5 source. Never labels missing dependencies PASS.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE_FILES=(
 'components/px68k/m68000/musashi/m68kcpu.c',
 'components/px68k/m68000/musashi/m68kops.c',
 'components/px68k/m68000/musashi/m68k.h',
 'src/panic_x_bin.c',
)

def digest(path:Path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(65536),b''):h.update(chunk)
 return h.hexdigest()

def run(args, dest):
 with dest.open('w',encoding='utf-8',errors='replace') as f:
  f.write('$ '+' '.join(map(str,args))+'\n\n')
  f.flush()
  try:
   result=subprocess.run([str(x) for x in args],cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,
                         check=False,timeout=1800)
   return result.returncode
  except subprocess.TimeoutExpired:
   f.write('\nSAFE STOP: subprocess exceeded 30 minutes\n')
   return 124
  except OSError as e:
   f.write(f'\nSAFE STOP: failed to launch: {e}\n')
   return 127

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--x68ktab-root',default='G:/X68KTab5' if os.name=='nt' else '')
 ap.add_argument('--report-dir',default='G:/' if os.name=='nt' else str(ROOT))
 a=ap.parse_args()
 src=Path(a.x68ktab_root).expanduser() if a.x68ktab_root else None
 dst=Path(a.report_dir).expanduser()
 if not dst.is_dir():
  print(f'SAFE STOP: report destination does not exist: {dst}',file=sys.stderr)
  return 2
 report=dst/'PWP_R15_SEND_THIS.zip'
 before={}
 if src:
  for rel in SOURCE_FILES:
   p=src/rel
   before[rel]=digest(p) if p.is_file() else None
 begin=time.time_ns()
 with tempfile.TemporaryDirectory(prefix='pwp_r15_report_') as scratch:
  scratch=Path(scratch)
  native_log=scratch/'native_musashi.log'
  wasm_log=scratch/'wasm_musashi.log'
  args=['--x68ktab-root',str(src)] if src else ['--x68ktab-root','SOURCE_NOT_AVAILABLE']
  native=run([sys.executable,ROOT/'tools'/'BUILD_R13_HOST_CPU.py',*args],native_log)
  wasm=None
  if native==0:
   wasm=run([sys.executable,ROOT/'tools'/'BUILD_R12_ACTUAL.py',*args],wasm_log)
  else:
   wasm_log.write_text('NOT RUN: native real-Musashi gate failed; WASM cannot be claimed PASS.\n',encoding='utf-8')
  after={}
  if src:
   for rel in SOURCE_FILES:
    p=src/rel
    after[rel]=digest(p) if p.is_file() else None
  same=before==after
  overall='PASS_REAL_CPU_GATES_ONLY_NOT_PAN_PLAYBACK' if native==0 and wasm==0 and same else 'SAFE_STOP'
  summary={'project':'Panic Player Web R15','status':overall,
           'real_native_cpu_rc':native,'real_wasm_cpu_rc':wasm,
           'x68ktab_root':str(src) if src else '',
           'production_source_sha256_before':before,'production_source_sha256_after':after,
           'source_unchanged':same,
           'pan_video_audio_playback_verified':False,
           'test_meaning':'native/WASM real CPU tests are mandatory; local regression alone cannot qualify real CPU'}
  (scratch/'SUMMARY.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
  with zipfile.ZipFile(report,'w',zipfile.ZIP_DEFLATED) as z:
   for fn in ('SUMMARY.json','native_musashi.log','wasm_musashi.log'):
    z.write(scratch/fn,fn)
   for evidence in ('R13_REAL_HOST_CPU_EVIDENCE.json','R12_REAL_CPU_MANIFEST.json'):
    path=ROOT/evidence
    if path.is_file() and path.stat().st_mtime_ns>=begin:
     z.write(path,evidence)
  print(f'RESULT: {overall}')
  print('ONE REPORT:',report)
  print('Native real CPU:',native,'WASM real CPU:',wasm)
  print('Production source unchanged:',same)
  return 0 if overall.startswith('PASS_') else 3

if __name__=='__main__':
 try:sys.exit(main())
 except Exception as ex:
  print(f'SAFE STOP: {ex}',file=sys.stderr)
  sys.exit(4)
