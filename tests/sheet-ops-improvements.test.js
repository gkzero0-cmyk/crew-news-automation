'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

assert.match(code, /SCRIPT_VERSION:\s*'crew-apps-script-v1\.7\.6'/, 'Apps Script version should advance');
assert.ok(code.includes('function validateCrewConfigAndMain_('), 'config/main validation helper should exist');
assert.ok(code.includes('function writeOperatorSummary_('), 'operator summary helper should exist');
assert.ok(code.includes("['ConfigValidation'"), 'status summary should expose config validation');
assert.ok(code.includes("['MemberCountValidation'"), 'status summary should expose member-count validation');
assert.ok(code.includes("['HealthyCrews'"), 'status summary should expose healthy crew count');
assert.ok(code.includes("['ConfigMembers'"), 'status summary should expose configured member count');
assert.match(code, /setLinkUrl\(0,\s*text\.length,\s*linkUrl\)/, 'crew-news text should link to the source across the full text');
assert.doesNotMatch(code, /setLinkUrl\(pinIndex,\s*pinIndex \+ 2,\s*linkUrl\)/, 'pin-only source links should no longer be used');
assert.ok(code.includes(".setUnderline(false)"), 'link styling must keep underlines disabled');
assert.ok(code.includes('validateCrewConfigAndMain_(main, crews)'), 'refresh should validate sheet/config consistency');
assert.ok(code.includes('writeOperatorSummary_(statusSheet'), 'refresh should write operator summary');

console.log('sheet operations improvements regression: ok');
