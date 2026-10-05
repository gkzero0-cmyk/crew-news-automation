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

const individualExternalUpPromoPost = {
  id: '209032075',
  title: '장지수용소 어인섬vs장지수용소 대전 컬러타일 1등한 안비비 도전',
  originalTitle: '어인섬vs장지수용소 대전 컬러타일 1등한 안비비 도전',
  author: '비비안♡',
  authorId: '8bibian8',
  station: '8bibian8',
  publishedAt: '2026-10-06 04:42:20',
  boardName: '👍업👍',
  accessType: 'public',
  contents: [
    '장지수용소 어인섬vs장지수용소 대전 컬러타일 1등한 안비비 도전',
    'https://www.sooplive.com/station/nemulumomo/post/208602017#comment122734167',
    '크흠 황새 9m의 도전~'
  ].join('\n'),
  imageUrl: ''
};

const individualExternalUpPromo = batch._internals.strictCrewPost(
  individualExternalUpPromoPost,
  '장지수용소',
  '8bibian8'
);
assert.ok(individualExternalUpPromo, 'core candidate extraction may still parse the post before final editorial qualification');
assert.equal(
  batch._internals.isIndividualExternalPromotionSelected({
    ok: true,
    strictCrew: '장지수용소',
    selected: individualExternalUpPromo,
    results: [{ station: '8bibian8', ok: true, posts: [individualExternalUpPromoPost] }]
  }),
  true,
  'an individual member UP/promotion post for an external content must be rejected at final crew-news qualification'
);

const collectiveExternalUpPromoPost = {
  id: 'collective-up',
  originalTitle: '릴파 콘텐츠 참가',
  title: '진드기 릴파 콘텐츠 참가',
  authorId: 'nsnowthemoon',
  station: 'nsnowthemoon',
  boardName: '👍업👍',
  contents: '진드기 팀으로 참가합니다.',
  publishedAt: '2026-10-06 05:00:00'
};
assert.equal(
  batch._internals.isIndividualExternalPromotionSelected({
    ok: true,
    strictCrew: '진드기',
    selected: { id: 'collective-up', station: 'nsnowthemoon' },
    results: [{ station: 'nsnowthemoon', ok: true, posts: [collectiveExternalUpPromoPost] }]
  }),
  false,
  'an UP-board post that explicitly says the crew/team participates together must remain eligible'
);

const recoveredPrevious = batch._internals.selectLatestEligibleCandidate([
  individualExternalUpPromoPost,
  {
    id: '208932989',
    title: '무수 합방',
    originalTitle: '오늘',
    author: '장지수',
    authorId: 'iamquaddurup',
    station: 'iamquaddurup',
    publishedAt: '2026-10-05 02:37:47',
    boardName: '🌎공지',
    accessType: 'public',
    postUrl: 'https://www.sooplive.com/station/iamquaddurup/post/208932989',
    imageUrl: '',
    sheetImageUrl: '',
    contents: [
      '도 재밌게 봐주셔서 감사합니다',
      '장지수용소 나들이 부터',
      '무수 합방까지 !!',
      '오늘 아침부터 사실 몸이 너무 안좋아서',
      '좀 약받아서 먹고 푹 쉬고 오겠습니다'
    ].join('\n')
  }
], '장지수용소');
assert.ok(recoveredPrevious, 'an invalid newest candidate must fall back to the next eligible crew-news candidate');
assert.equal(recoveredPrevious.id, '208932989', 'the 10/5 outing must replace the invalid 10/6 personal UP promotion');

const recoveredPayload = batch._internals.applyOutputPolicy({
  ok: true,
  strictCrew: '장지수용소',
  selected: recoveredPrevious,
  results: [],
  previousFingerprint: '',
  preservePrevious: false
}, {
  blankUrl: batch._internals.BLANK_SHEET_IMAGE_URL,
  stableFingerprint: batch._internals.stableFingerprint
});
assert.equal(recoveredPayload.selected.displaySummary, '장지수용소 나들이');
assert.equal(recoveredPayload.selected.displayText, '장지수용소 - 장지수용소 나들이 (10/5) 📌');

console.log('external participation title regression: ok');
