'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const code=fs.readFileSync(require.resolve('../apps-script/Code.gs'),'utf8');
const v181=fs.readFileSync(require.resolve('../apps-script/StyleSelfHealV181.gs'),'utf8');
const packageJson=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
const v182Path=path.join(__dirname,'../apps-script/PolicySyncV182.gs');

assert.ok(code.includes('TRIGGER_MINUTES: 30'),'base automation interval must remain 30 minutes');
assert.ok(v181.includes('.everyMinutes(CREW_AUTOMATION.TRIGGER_MINUTES)'),'v1.8.1 must inherit the 30-minute base interval');
assert.ok(!fs.existsSync(v182Path),'10-minute PolicySyncV182 wrapper must not exist');
assert.ok(!packageJson.scripts.test.includes('apps-script-v182-10min-policy.test.js'),'10-minute regression must not remain in test chain');
console.log('Apps Script 30-minute policy regression: ok');
