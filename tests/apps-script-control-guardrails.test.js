'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

assert.match(code, /SCRIPT_VERSION:\s*'crew-apps-script-v1\.8\.0'/, 'Apps Script must advance to v1.8.0');
assert.ok(code.includes("CONTROL_SHEET: '자동화 제어'"), 'manual control sheet must be configured');
assert.ok(code.includes("AUDIT_SHEET: '자동화 판정 이력'"), 'candidate audit sheet must be configured');
assert.ok(code.includes('function readCrewControls_('), 'control sheet reader must exist');
assert.ok(code.includes('function resolveManualControl_('), 'manual control decision helper must exist');
assert.ok(code.includes('function applyCrewControlUpdates_('), 'control state persistence helper must exist');
assert.ok(code.includes('function isVerifiedClearPayload_('), 'verified-clear helper must exist');
assert.ok(code.includes('function appendCandidateAuditBatch_('), 'candidate audit writer must exist');
assert.ok(code.includes('payload.clearVerified === true'), 'no-news clearing must require server clearVerified');
assert.ok(code.includes("control.mode = '자동'"), 'temporary lock must be able to release back to automatic mode');
assert.ok(code.includes("normalizeControlMode_(control.mode) === '영구 고정'"), 'permanent manual lock must be honored');
assert.ok(code.includes('diagnostics.auditPayloads[crew.crew] = payload'), 'the exact payload used for each crew must be available to audit logging');

console.log('Apps Script control + clear guardrails regression: ok');
