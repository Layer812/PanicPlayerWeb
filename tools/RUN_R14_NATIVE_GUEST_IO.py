#!/usr/bin/env python3
"""R14 real-CPU-only end-to-end guest file I/O acceptance.

Assemble *actual* 68000 instructions into a small Human68k HU executable.
Run them under the compiled Musashi adapter, dispatch actual DOS traps, and
transfer >64 KiB of deterministic content through a native 64-bit stage pointer.
This script cannot report PASS by invoking a mock or inspecting source strings.
"""
from __future__ import annotations
import argparse
import ctypes
import json
from pathlib import Path
import sys
from RUN_R13_NATIVE_CPU import open_lib, stage, check

FILE_SIZE = 160000
FIRST_READ = 130000
SOURCE_PATTERN = lambda i: (i*37+11)&255
PATH_ADDR=0x10500
DST_ADDR=0x10800
DST2_ADDR=0x31800


def op16(number):
    return number.to_bytes(2,'big')


def push_word(v):
    return bytes.fromhex('3f3c')+op16(v)


def push_long(v):
    return bytes.fromhex('2f3c')+v.to_bytes(4,'big')


def lea_sp(n):
    return bytes.fromhex('4fef')+op16(n)


def synth_hu():
    # These are 68000 machine instructions; no host-side fake register values.
    code=bytearray()
    code+=push_word(0)+push_long(PATH_ADDR)+bytes.fromhex('ff3d')+lea_sp(6)
    code+=push_long(FIRST_READ)+push_long(DST_ADDR)+push_word(5)+bytes.fromhex('ff3f')+lea_sp(10)
    code+=push_word(0)+push_long(0)+push_word(5)+bytes.fromhex('ff42')+lea_sp(8)
    code+=push_long(8)+push_long(DST2_ADDR)+push_word(5)+bytes.fromhex('ff3f')+lea_sp(10)
    code+=push_word(5)+bytes.fromhex('ff3e')+lea_sp(2)
    code+=bytes.fromhex('ff00')
    assert len(code)<0x500
    image=bytearray(0x700)
    image[:len(code)]=code
    image[PATH_ADDR-0x10000:PATH_ADDR-0x10000+12]=b'C:\\P68K.PAN\0'
    result=bytearray(64+len(image))
    result[:2]=b'HU'
    result[12:16]=len(image).to_bytes(4,'big')
    result[64:]=image
    return bytes(result)


def attach(lib):
    for name, ret, args in [
        ('pwp_mu_io_stage_native_ptr',ctypes.c_void_p,[]),
        ('pwp_mu_io_stage_ptr',ctypes.c_uint32,[]),
        ('pwp_mu_set_pan_size',None,[ctypes.c_uint32,ctypes.c_uint32]),
        ('pwp_mu_io_offset_low',ctypes.c_uint32,[]),
        ('pwp_mu_io_offset_high',ctypes.c_uint32,[]),
        ('pwp_mu_io_length',ctypes.c_uint32,[]),
        ('pwp_mu_io_capacity',ctypes.c_uint32,[]),
        ('pwp_mu_supply_read',ctypes.c_int32,[ctypes.c_uint32])
    ]:
        f=getattr(lib,name)
        f.restype=ret
        f.argtypes=args


def run(lib):
    attach(lib)
    stage(lib,synth_hu())
    lib.pwp_mu_set_pan_size(0,FILE_SIZE)
    events=[]
    read_requests=0
    iterations=0
    while len(events)<20 and iterations<200:
        iterations+=1
        pc_before=lib.pwp_mu_pc()
        result=lib.pwp_mu_run(100)
        if result==1:
            check(lib.pwp_mu_pc()!=pc_before,'CPU made no instruction progress')
        if result==2:
            trap=lib.pwp_mu_trap()
            events.append(f'{trap:04x}')
            result=lib.pwp_mu_dispatch()
            if trap==0xff3d:
                check(result==1 and lib.pwp_mu_register(0)==5,'guest _OPEN handle')
            if trap==0xff42:
                check(result==1 and lib.pwp_mu_register(0)==0,'guest _SEEK origin')
            if trap==0xff3e:
                check(result==1 and lib.pwp_mu_register(0)==0,'guest _CLOSE')
            if trap==0xff00:
                check(result==4,'guest _EXIT')
        if result==3:
            offset=(lib.pwp_mu_io_offset_high()<<32)|lib.pwp_mu_io_offset_low()
            count=lib.pwp_mu_io_length()
            check(0<count<=65536 and count<=lib.pwp_mu_io_capacity(),'bounded guest _READ')
            check(offset+count<=FILE_SIZE,'guest file request bound')
            ptr=lib.pwp_mu_io_stage_native_ptr()
            check(ptr is not None and ptr>4096,'64-bit native staging pointer')
            ctypes.memmove(ptr,bytes(SOURCE_PATTERN(i) for i in range(offset,offset+count)),count)
            read_requests+=1
            result=lib.pwp_mu_supply_read(count)
            check(result in (1,3),'guest I/O callback state')
        if result==4: break
        check(result in (1,2,3),'real 68000 guest runtime status')
    check(iterations<200, 'bounded CPU/guest I/O acceptance loop')
    check(events==['ff3d','ff3f','ff42','ff3f','ff3e','ff00'],
          f'actual DOS call order {events}')
    check(read_requests==3,f'64KiB chunk count {read_requests}')
    for off in (0,1,65535,65536,129999):
        check(lib.pwp_mu_guest_peek8(DST_ADDR+off)==SOURCE_PATTERN(off),
              f'guest bulk data offset {off}')
    for off in range(8):
        check(lib.pwp_mu_guest_peek8(DST2_ADDR+off)==SOURCE_PATTERN(off),
              f'guest seek+read data offset {off}')
    return {'result':'REAL_NATIVE_MUSASHI_GUEST_IO_PASS',
            'verified_68000_traps':events,
            'bytes_first_read':FIRST_READ,'bytes_second_read':8,
            'io_request_chunks':read_requests,'verified_guest_bytes':13,
            'cpu':'linked real Musashi, no mock accepted',
            'not_tested':['browser WASM','PAN picture or sound']}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('library',type=Path)
    ap.add_argument('--evidence',type=Path)
    args=ap.parse_args()
    if args.evidence: args.evidence.unlink(missing_ok=True)
    result=run(open_lib(args.library))
    if args.evidence: args.evidence.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))

if __name__=='__main__':
    try: main()
    except Exception as ex:
        print(f'SAFE STOP R14 real native guest I/O: {ex}',file=sys.stderr)
        sys.exit(1)
