'use strict';
const assert = require('node:assert/strict');
const batch = require('../api/crew-news-batch.js')._internals;

const event = {
  id: 'evt1',
  station: 'member1',
  postUrl: 'https://www.sooplive.com/station/member1/post/evt1',
  activity: '정기회의',
  displaySummary: '테스트크루 정기회의',
  activityDate: '2026-10-01',
  publishedAt: '2026-10-01 18:00:00',
  sourcePublishedAt: '2026-10-01 18:00:00',
  author: '테스트멤버',
  imageUrl: 'https://example.com/meeting.png',
  sheetImageUrl: 'https://example.com/meeting.png',
  imageSource: 'post_member',
  isCrewLeader: false,
  official: true,
  titleActivityExplicit: true,
  _clusterPosts: [
    {station:'member1', leader:false, official:true},
    {station:'leader1', leader:true, official:true}
  ]
};

const selected = batch.buildSelected('테스트크루', event, 'fp-test');
assert.equal(selected.author, '테스트멤버');
assert.equal(selected.evidenceCount, 2);
assert.equal(selected.leaderEvidence, true);
assert.equal(selected.officialEvidence, true);
assert.equal(selected.selectionReason, '수장 포함 복수 근거');
assert.equal(selected.imageReason, '같은 이벤트 크루원 게시글 이미지');

const annotated = batch.annotatePayloadDiagnostics({
  ok:true,
  complete:true,
  rawCandidateCount:12,
  latestRawPublishedAt:'2026-10-03 20:00:00',
  selected:{
    ...selected,
    sourcePublishedAt:'2026-10-01 18:00:00',
    activityDate:'2026-09-20',
    imageSource:'none',
    imageUrl:'',
    sheetImageUrl:'https://crew-news-automation.vercel.app/api/blank-image'
  }
}, Date.parse('2026-10-04T00:00:00+09:00'));

assert.equal(annotated.selected.imageReason, '적합 이미지 없음');
assert.equal(annotated.selected.newPostsDiagnostic, '새 글 있음 / 크루소식 후보 제외');
assert.equal(annotated.selected.staleStatus, '오래된 소식 14일+');
assert.equal(annotated.selected.ageDays, 14);
assert.equal(annotated.selected.latestRawPublishedAt, '2026-10-03 20:00:00');

console.log('selection diagnostics metadata: ok');
