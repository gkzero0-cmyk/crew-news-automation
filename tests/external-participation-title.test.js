'use strict';

const assert = require('node:assert/strict');
const batch = require('../api/crew-news-batch.js');

const confirmedExternalParticipation = batch._internals.strictCrewPost({
  id: 'confirmed-external-content',
  title: '진드기 콘텐츠 참가 안내',
  originalTitle: '진드기 콘텐츠 참가 안내',
  author: '설빈달',
  authorId: 'nsnowthemoon',
  publishedAt: '2026-10-05 10:00:00',
  boardName: '공지',
  accessType: 'public',
  contents: [
    '릴파님의 콘텐츠에 진드기 팀으로 지원했고 최종 선발됐습니다.',
    '진드기 팀으로 참가 확정되어 함께 출전합니다.'
  ].join('\n'),
  imageUrl: ''
}, '진드기', 'nsnowthemoon');

assert.ok(confirmedExternalParticipation, 'confirmed external participation should remain eligible crew news');
assert.equal(
  confirmedExternalParticipation.displaySummary,
  '릴파 콘텐츠 참가',
  'confirmed participation in another broadcaster\'s content must name the external content instead of implying the crew is the host'
);

const individualExternalUpPromo = batch._internals.strictCrewPost({
  id: '209032075',
  title: '장지수용소 어인섬vs장지수용소 대전 컬러타일 1등한 안비비 도전',
  originalTitle: '어인섬vs장지수용소 대전 컬러타일 1등한 안비비 도전',
  author: '비비안♡',
  authorId: '8bibian8',
  publishedAt: '2026-10-06 04:42:20',
  boardName: '👍업👍',
  accessType: 'public',
  contents: [
    '장지수용소 어인섬vs장지수용소 대전 컬러타일 1등한 안비비 도전',
    'https://www.sooplive.com/station/nemulumomo/post/208602017#comment122734167',
    '크흠 황새 9m의 도전~'
  ].join('\n'),
  imageUrl: ''
}, '장지수용소', '8bibian8');

assert.equal(
  individualExternalUpPromo,
  null,
  'an individual member promotion/UP request for an external content must not become crew news just because the crew name appears in the post'
);

console.log('external participation title regression: ok');
