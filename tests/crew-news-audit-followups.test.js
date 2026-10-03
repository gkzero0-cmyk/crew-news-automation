'use strict';

const assert = require('assert');
const batch = require('../api/crew-news-batch.js');
const {
  strictCrewPost,
  sameRepresentativeActivity,
  compareRepresentativeCandidates
} = batch._internals;

const completedTripWithFollowup = strictCrewPost({
  id: '208784427',
  title: '한국 도착!',
  originalTitle: '한국 도착!',
  author: '설빈달',
  authorId: 'nsnowthemoon',
  publishedAt: '2026-10-03 17:10:29',
  boardName: '🌙방송 공지',
  accessType: 'public',
  postUrl: 'https://www.sooplive.com/station/nsnowthemoon/post/208784427',
  contents: [
    '진드기 여행',
    '날씨가 맑았던 여행이 정말 정말 오랜만이라 기분 좋게 집에 갑니댜.',
    '오늘 푹쉬구 내일 진드기 후기 뱅으로 봅시다!!!'
  ].join('\n')
}, '진드기', 'nsnowthemoon');

assert.strictEqual(
  completedTripWithFollowup,
  null,
  'a completed trip post that only schedules a later review stream must not become a new trip event'
);

const leaderContest = {
  representativeTier: 1,
  isCrewLeader: true,
  strictActivity: '천타버스 VS 버인협회 더헌터 사냥대결',
  activityDate: '2026-09-30',
  sourcePublishedAt: '2026-09-30 01:45:38'
};
const memberContest = {
  representativeTier: 2,
  isCrewLeader: false,
  strictActivity: '사냥대결',
  activityDate: '2026-09-30',
  sourcePublishedAt: '2026-09-30 14:23:36'
};
assert.strictEqual(
  sameRepresentativeActivity(leaderContest, memberContest),
  true,
  'same-day contest labels with the same activity family should be treated as one event'
);
assert(
  compareRepresentativeCandidates(leaderContest, memberContest) < 0,
  'within the same contest, the stronger representative should beat a later generic member post'
);

const leaderContent = {
  representativeTier: 1,
  isCrewLeader: true,
  strictActivity: '콘텐츠',
  activityDate: '2026-10-02',
  sourcePublishedAt: '2026-10-02 05:04:58'
};
const memberCollab = {
  representativeTier: 2,
  isCrewLeader: false,
  strictActivity: '합방',
  activityDate: '2026-10-02',
  sourcePublishedAt: '2026-10-02 14:02:45'
};
assert.strictEqual(
  sameRepresentativeActivity(leaderContent, memberCollab),
  true,
  'same-day generic crew content/collab labels should be treated as one representative event'
);
assert(
  compareRepresentativeCandidates(leaderContent, memberCollab) < 0,
  'same-day generic member wording must not replace a more representative leader source'
);

console.log('crew-news audit followups regression: ok');
