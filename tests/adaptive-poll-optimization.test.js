'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crewNews = require('../internal/crew-news.js');
const batchCore = require('../internal/crew-news-batch-core.js');

const crewInternals = crewNews._internals || {};
const batchInternals = batchCore._internals || {};

assert.equal(typeof crewInternals.shouldFetchMenuForRows, 'function', 'lazy menu decision helper should exist');
assert.equal(
  crewInternals.shouldFetchMenuForRows([
    { title_name: '그냥 오늘 방송', content: { text_content: '잡담입니다' }, bbs_no: '1' }
  ], '조적단'),
  false,
  'rows without crew/activity signals should not force a menu lookup'
);
assert.equal(
  crewInternals.shouldFetchMenuForRows([
    { title_name: '조적단 내일 일정', content: { text_content: '저녁에 만나요' }, bbs_no: '1' }
  ], '조적단'),
  true,
  'crew-named rows still need board metadata for exclusion/official-board checks'
);
assert.equal(
  crewInternals.shouldFetchMenuForRows([
    { title_name: '내일 정기회의', content: { text_content: '8시에 진행합니다' }, bbs_no: '1' }
  ], '조적단'),
  true,
  'activity-only rows still need board metadata because crew-board context can make them relevant'
);
assert.equal(
  crewInternals.shouldFetchMenuForRows([], ''),
  true,
  'generic/direct API calls keep full menu fidelity when no crew context is supplied'
);

assert.equal(typeof batchInternals.buildVodSearchPlan, 'function', 'VOD staged search plan helper should exist');
assert.deepEqual(
  batchInternals.buildVodSearchPlan(
    ['leader', 'member1', 'member2', 'member3', 'member4'],
    'member2',
    'leader'
  ),
  {
    priority: ['member2', 'leader'],
    secondary: ['member1', 'member3', 'member4']
  },
  'VOD search should check selected source and leader first, then remaining members'
);
assert.equal(typeof batchInternals.isStrongVodFallbackCandidate, 'function', 'strong VOD candidate helper should exist');
assert.equal(batchInternals.isStrongVodFallbackCandidate({ score: 24, vod: { imageUrl: 'https://img.example/a.png' } }), true);
assert.equal(batchInternals.isStrongVodFallbackCandidate({ score: 23, vod: { imageUrl: 'https://img.example/a.png' } }), false);
assert.equal(batchInternals.isStrongVodFallbackCandidate({ score: 30, vod: { imageUrl: '' } }), false);

const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
assert.match(code, /SCRIPT_VERSION:\s*'crew-apps-script-v1\.7\.5'/);
assert.match(code, /TRIGGER_MINUTES:\s*30/);
assert.ok(code.includes(".addItem('30분 자동갱신 설치'"), 'Apps Script menu should describe the real interval');
assert.ok(code.includes("String(CREW_AUTOMATION.TRIGGER_MINUTES) + '분'"), 'status interval should come from the configured interval');
assert.ok(!code.includes("      '10분',"), 'legacy hard-coded 10-minute status label must be removed');

console.log('adaptive polling optimization regression: ok');
