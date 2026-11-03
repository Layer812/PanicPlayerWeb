// Clock Cat: real X68000 IOCS RTC conversion edge cases.
// Only native helper math is tested here; browser host-clock integration
// is exercised by the existing emcc build gate in GitHub CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('FIX46: _TIMEGET/_TIMEBIN and _DATEGET encode X68000 BCD correctly',t=>{
  const cc=process.env.CC||'cc';
  if(spawnSync(cc,['--version'],{encoding:'utf8'}).error) {
    t.skip('native C compiler not installed'); return;
  }
  const dir=mkdtempSync(join(tmpdir(),'pwp-clockcat-rtc-'));
  try {
    const source=join(dir,'rtc.c'), exe=join(dir,process.platform==='win32'?'rtc.exe':'rtc');
    writeFileSync(source,`
#include <assert.h>
#include "pwp_iocs_rtc.h"
int main(void) {
  assert(pwp_iocs_time_bcd(14,29,45)==0x00142945u);
  assert(pwp_iocs_time_bcd_valid(0x00142945u));
  assert(pwp_iocs_time_bin(0x00142945u)==0x000e1d2du);
  assert(pwp_iocs_time_bcd(0,0,0)==0u);
  assert(pwp_iocs_time_bcd(23,59,59)==0x00235959u);
  assert(pwp_iocs_time_bin(0x00235959u)==0x00173b3bu);
  assert(!pwp_iocs_time_bcd_valid(0x00245a59u));
  assert(!pwp_iocs_time_bcd_valid(0xff235959u));
  assert(pwp_iocs_date_bcd(2026,11,3,2)==0x02261103u);
  assert(pwp_iocs_date_bcd(1999,12,31,5)==0x05991231u);
  return 0;
}`,'utf8');
    const build=spawnSync(cc,['-std=c11','-O2','-Wall','-Wextra','-Werror','-I',resolve('core'),source,'-o',exe],{encoding:'utf8'});
    assert.equal(build.status,0,build.stdout+build.stderr);
    const run=spawnSync(exe,[],{encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
