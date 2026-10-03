'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
const ctx = vm.createContext({console, Date, JSON, Object, String, Array, Number, Math});
vm.runInContext(source, ctx);

assert.equal(vm.runInContext('CREW_AUTOMATION.SCRIPT_VERSION', ctx), 'crew-apps-script-v1.8.0');
const result = vm.runInContext(`JSON.stringify(buildStatusDiagnosticValues_({
  crew:'테스트', checkedAt:new Date('2026-10-04T00:00:00Z'), successAt:new Date('2026-10-04T00:00:00Z'),
  author:'작성자', publishedAt:'2026-10-01 18:00:00', newsText:'테스트 소식', postUrl:'https://example.com/post',
  imageUrl:'', imageState:'이미지 없음(셀 비움)', error:'', sourceType:'크루원', fingerprint:'fp', writeAction:'skip_unchanged', healthStatus:'healthy',
  selectionReason:'수장 포함 복수 근거', imageReason:'적합 이미지 없음', evidenceCount:2, leaderEvidence:true,
  newPostsDiagnostic:'새 글 있음 / 크루소식 후보 제외', staleStatus:'정상', ageDays:3, latestRawPublishedAt:'2026-10-03 20:00:00'
}, new Array(23).fill('')))`, ctx);
const row = JSON.parse(result);
assert.equal(row.length, 23);
assert.deepEqual(row.slice(15), [
  '수장 포함 복수 근거', '적합 이미지 없음', 2, 'O',
  '새 글 있음 / 크루소식 후보 제외', '정상', 3, '2026-10-03 20:00:00'
]);
console.log('Apps Script status diagnostics columns: ok');
