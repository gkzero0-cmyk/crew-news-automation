'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const addonPath = path.join(__dirname, '..', 'apps-script', 'ControlAuditV180.gs');
assert.ok(fs.existsSync(addonPath), 'ControlAuditV180.gs must exist');
const code = fs.readFileSync(addonPath, 'utf8');

assert.match(code, /SCRIPT_VERSION:\s*'crew-apps-script-v1\.8\.0'/, 'v1.8 add-on must identify its version');
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
assert.ok(code.includes('refreshOneCrew_(mainSheet, crew, payload, diagnostics)'), 'guarded v1.8 path must reuse the proven v1.7 crew writer after safety checks');

const context = { console, Date, Math, JSON, String, Number, Boolean, Object, Array, RegExp, encodeURIComponent };
vm.createContext(context);
vm.runInContext(code, context);

const checkedAt = new Date('2026-10-06T00:30:00.000Z');
const permanent = context.resolveManualControl_(
  { mode: '영구 고정', lockedUrl: '', lockedAt: '' },
  { ok: true, selected: { postUrl: 'https://example.com/new', sourcePublishedAt: '2026-10-06 09:00:00' } },
  'https://example.com/current',
  checkedAt
);
assert.equal(permanent.preserve, true, 'permanent lock must always preserve the current sheet value');
assert.equal(permanent.capture, true, 'permanent lock must capture a baseline when first enabled');

const temporaryFirstRun = context.resolveManualControl_(
  { mode: '임시 고정', lockedUrl: '', lockedAt: '' },
  { ok: true, selected: { postUrl: 'https://example.com/new', sourcePublishedAt: '2026-10-06 09:00:00' } },
  'https://example.com/current',
  checkedAt
);
assert.equal(temporaryFirstRun.preserve, true, 'temporary lock must preserve immediately after being enabled');
assert.equal(temporaryFirstRun.capture, true, 'temporary lock must capture its baseline on first run');

const temporaryNewer = context.resolveManualControl_(
  { mode: '임시 고정', lockedUrl: 'https://example.com/current', lockedAt: '2026-10-05T22:00:00.000Z' },
  { ok: true, selected: { postUrl: 'https://example.com/new', sourcePublishedAt: '2026-10-06 09:00:00' } },
  'https://example.com/current',
  checkedAt
);
assert.equal(temporaryNewer.release, true, 'temporary lock must release for a genuinely newer different event');
assert.equal(temporaryNewer.preserve, false, 'released temporary lock must allow the new event to write');

const temporaryOlder = context.resolveManualControl_(
  { mode: '임시 고정', lockedUrl: 'https://example.com/current', lockedAt: '2026-10-06T00:00:00.000Z' },
  { ok: true, selected: { postUrl: 'https://example.com/old', sourcePublishedAt: '2026-10-05 08:00:00' } },
  'https://example.com/current',
  checkedAt
);
assert.equal(temporaryOlder.preserve, true, 'temporary lock must not release for an older candidate');

const verifiedClear = context.isVerifiedClearPayload_({
  ok: true,
  complete: true,
  healthStatus: 'healthy',
  preservePrevious: false,
  reliableEmpty: true,
  clearVerified: true,
  candidateAuditComplete: true,
  eligibleCandidateCount: 0,
  failed: 0,
  auxiliaryFailed: 0
});
assert.equal(verifiedClear, true, 'fully verified empty result may clear the sheet');
assert.equal(context.isVerifiedClearPayload_({
  ok: true,
  complete: true,
  healthStatus: 'healthy',
  reliableEmpty: true,
  candidateAuditComplete: true,
  eligibleCandidateCount: 0,
  failed: 0,
  auxiliaryFailed: 0
}), false, 'missing clearVerified proof must never clear the sheet');

console.log('Apps Script control + clear guardrails regression: ok');
