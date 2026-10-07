'use strict';

const assert = require('assert');
const batch = require('../api/crew-news-batch.js');
const { compareRepresentativeCandidates, shouldAttemptEnrichment } = batch._internals;

const olderLeader = {
  representativeTier: 1,
  isCrewLeader: true,
  strictActivity: '러닝',
  activityDate: '2026-09-18',
  sourcePublishedAt: '2026-09-18 11:47:21'
};

const newerMember = {
  representativeTier: 2,
  isCrewLeader: false,
  strictActivity: '점호',
  activityDate: '2026-09-28',
  sourcePublishedAt: '2026-09-28 12:41:35'
};

assert(
  compareRepresentativeCandidates(newerMember, olderLeader) < 0,
  'newer member activity must outrank an older leader activity'
);
assert(
  compareRepresentativeCandidates(olderLeader, newerMember) > 0,
  'older leader activity must not pin above a newer member activity'
);

const sameEventMember = {
  representativeTier: 2,
  representativeMediaPriority: 0,
  isCrewLeader: false,
  strictActivity: '점호',
  activityDate: '2026-09-28',
  sourcePublishedAt: '2026-09-28 12:50:00'
};

const sameEventLeader = {
  representativeTier: 1,
  representativeMediaPriority: 0,
  isCrewLeader: true,
  strictActivity: '점호',
  activityDate: '2026-09-28',
  sourcePublishedAt: '2026-09-28 12:40:00'
};

assert(
  compareRepresentativeCandidates(sameEventLeader, sameEventMember) < 0,
  'leader representative should remain preferred inside the same activity/date'
);

assert.strictEqual(
  shouldAttemptEnrichment({
    ok: true,
    strictCrew: '강씨세가',
    healthStatus: 'suspicious_empty',
    preservePrevious: true,
    selected: null
  }),
  true,
  'suspicious_empty must still run event-cluster enrichment so raw member posts can recover the event'
);

assert.strictEqual(
  shouldAttemptEnrichment({
    ok: true,
    strictCrew: '강씨세가',
    healthStatus: 'degraded',
    preservePrevious: true,
    selected: null
  }),
  false,
  'degraded upstream data must keep preserve-previous protection and skip enrichment'
);


const linkedPromoSelected = {
  id: '209114553', strictActivity: '모집', displaySummary: '자라섬 모집',
  activityDate: '2026-10-07', sourcePublishedAt: '2026-10-07 03:24:56'
};
const linkedLeaderEvent = {
  id: '209068529', activity: '버추얼 크루원 인턴 모집', displaySummary: '자라섬 버추얼 크루원 인턴 모집',
  activityDate: '2026-10-06', sourcePublishedAt: '2026-10-06 19:00:28', representativeTier: 1, isCrewLeader: true
};
const linkedPromoPost = {
  id: '209114553',
  contents: '자라섬 크루 인턴 모집 합니다 :) 뻐꾸기 많이 부탁드려요! https://www.sooplive.com/station/dstv/post/209068529'
};
assert.strictEqual(
  batch._internals.sameEvent(linkedPromoSelected, linkedLeaderEvent, linkedPromoPost),
  true,
  'a newer member promo that directly links the representative crew post must remain the same event across adjacent dates'
);
assert.strictEqual(
  batch._internals.sameEvent(
    {...linkedPromoSelected, strictActivity:'정기회의', displaySummary:'자라섬 정기회의'},
    linkedLeaderEvent,
    {id:'new-event', contents:'오늘은 자라섬 정기회의 진행합니다'}
  ),
  false,
  'a genuinely different newer activity must not be pulled back to an older leader post'
);

assert.strictEqual(
  shouldAttemptEnrichment({
    ok:true,
    strictCrew:'자라섬',
    healthStatus:'healthy',
    preservePrevious:false,
    selected:{id:'209114553',summary:'모집',displaySummary:'자라섬 모집',imageUrl:'https://example.com/member.png',activityDate:'2026-10-07'},
    results:[{posts:[{
      id:'209114553',
      originalTitle:'261007 오늘',
      contents:'자라섬 크루 인턴 모집 합니다. 뻐꾸기 부탁드려요! https://www.sooplive.com/station/dstv/post/209068529'
    }]}]
  }),
  true,
  'a selected post that directly links another SOOP post must trigger representative-source enrichment'
);

console.log('representative-selection regression: ok');
