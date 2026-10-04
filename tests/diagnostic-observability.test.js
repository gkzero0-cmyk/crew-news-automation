'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const enrichment = require('../lib/event-enrichment.js');

function post({id, station, title, contents='', boardName='공지', publishedAt='2026-10-04 12:00:00', imageUrl=''}) {
  return {
    id, station, authorId:station, author:station, title, originalTitle:title, contents, boardName,
    publishedAt,
    postUrl:`https://www.sooplive.com/station/${station}/post/${id}`,
    imageUrl,
    sheetImageUrl:imageUrl ? `https://proxy.example/image/${id}` : ''
  };
}

const multi = enrichment.synthesizeCrewEvent([
  post({id:'1', station:'member1', title:'테스트크루 VRC 놀숲 진행', publishedAt:'2026-10-04 10:00:00'}),
  post({id:'2', station:'member2', title:'오늘 테스트크루 VRC 놀숲 같이 합니다', publishedAt:'2026-10-04 11:00:00'})
], '테스트크루', 'leader');
assert.ok(multi, 'multi-member event should synthesize');
assert.equal(multi.evidenceCount, 2);
assert.deepEqual(multi.evidenceStations.sort(), ['member1','member2']);
assert.equal(multi.selectionReason, '크루원 다수 일치');

const leader = enrichment.synthesizeCrewEvent([
  post({id:'3', station:'leader', title:'테스트크루 정기회의', boardName:'공지사항', imageUrl:'https://img.example/meeting.png'})
], '테스트크루', 'leader');
assert.ok(leader, 'leader event should synthesize');
assert.equal(leader.selectionReason, '크루장 공식공지');
assert.equal(leader.evidenceCount, 1);

const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
assert.match(code, /SCRIPT_VERSION:\s*'crew-apps-script-v1\.7\.4'/);
for (const header of ['대표선정이유','이미지선정이유','근거수','근거작성자','진단플래그']) {
  assert.ok(code.includes(header), `Code.gs should expose ${header}`);
}
assert.match(code, /new_posts_seen_no_new_event/);
assert.match(code, /stale_14d_plus/);

// This suite intentionally covers both event-source diagnostics and sheet-visible diagnostics.
console.log('crew diagnostic observability regression: ok');
