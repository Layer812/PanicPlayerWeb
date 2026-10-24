#!/usr/bin/env python3
"""Only listen on 127.0.0.1. Serve the already-built actual Musashi app.
The user's .PAN stays at its original Windows path and is served read-only.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import webbrowser

ROOT=Path(__file__).resolve().parents[1]
PINSHA='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'

def sha(p):
    with p.open('rb') as f:return hashlib.sha256(f.read()).hexdigest()

def verify_files(pan):
    if not pan.is_file() or pan.suffix.lower()!='.pan' or pan.stat().st_size==0:
        raise RuntimeError('Actual .PAN input missing: '+str(pan))
    hu=ROOT/'core/PANIC.X'
    wasm=ROOT/'core/pwp_musashi.wasm'
    glue=ROOT/'core/pwp_musashi.mjs'
    if not hu.is_file() or sha(hu)!=PINSHA:raise RuntimeError('Original PANIC.X absent or SHA-256 mismatch')
    if not wasm.is_file() or wasm.read_bytes()[:4]!=b'\0asm' or not glue.is_file():
        raise RuntimeError('Real Musashi WASM is missing. Run START_PANIC_PLAYER.cmd')

class Handler(SimpleHTTPRequestHandler):
    pan_file=None
    def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT),**kw)
    def do_GET(self):
        route=urlsplit(self.path).path
        if route=='/__local_pan_meta':
            payload=json.dumps({'name':self.pan_file.name,'size':self.pan_file.stat().st_size},ensure_ascii=False).encode('utf8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(payload)))
            self.end_headers();self.wfile.write(payload);return
        if route=='/__local_pan':
            file=self.pan_file
            self.send_response(200);self.send_header('Content-Type','application/octet-stream')
            self.send_header('Content-Length',str(file.stat().st_size));self.send_header('Cache-Control','no-store');self.end_headers()
            with file.open('rb') as f:
                while b:=f.read(65536):self.wfile.write(b)
            return
        return super().do_GET()
    def end_headers(self):
        # Never reuse cached JS/WASM from the earlier player.
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        super().end_headers()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pan',type=Path,required=True);ap.add_argument('--port',type=int,default=0);ap.add_argument('--no-browser',action='store_true');args=ap.parse_args()
    pan=args.pan.resolve(strict=True);verify_files(pan)
    Handler.pan_file=pan
    with ThreadingHTTPServer(('127.0.0.1',args.port),Handler) as server:
        url=f'http://127.0.0.1:{server.server_address[1]}/?autoload=1&release=FIX24'
        print('PANIC PLAYER real Musashi local browser:',url,flush=True)
        print('PAN read-only:',pan.name,'(',pan.stat().st_size,'bytes)',flush=True)
        print('Stop: Ctrl+C. No upload or firmware flash.',flush=True)
        if not args.no_browser:webbrowser.open(url)
        try:server.serve_forever()
        except KeyboardInterrupt:pass

if __name__=='__main__':main()
