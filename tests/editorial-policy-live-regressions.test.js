'use strict';

const assert = require('node:assert/strict');
const enrichment = require('../lib/event-enrichment.js');
const batch = require('../api/crew-news-batch.js');

const actualMerifurryAvatarCelebration = enrichment.synthesizeCrewEvent([
  {
    id: '208886779',
    station: 'beemong',
    authorId: 'beemong',
    author: '비몽♪',
    title: '우리 희또의 오리지널 데뷔를 머러퍼리 일동이 축하합니다',
    originalTitle: '우리 희또의 오리지널 데뷔를 머러퍼리 일동이 축하합니다',
    publishedAt: '2026-10-04 19:20:26',
    boardName: '📢방송공지',
    contents: [
      '희또의 개쩌는 오리지널 데뷔를 축하드립니다!!!!',
      '이제 새로워졌으니',
      '면접 다시보겠습니다',
      '다음 회의때까지 준비해와주세요^^'
    ].join('\n'),
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/9/24931119/39901791109188051.png'
  }
], '머리퍼리', 'beemong');
assert.equal(
  actualMerifurryAvatarCelebration,
  null,
  'the actual original-avatar debut celebration must not be reinterpreted as a crew interview by enrichment'
);

const actualJindeugiApplication = enrichment.synthesizeCrewEvent([
  {
    id: '208908355',
    station: 'nsnowthemoon',
    authorId: 'nsnowthemoon',
    author: '설빈달',
    title: '진드기 콘텐츠',
    originalTitle: '진드기 콘텐츠',
    publishedAt: '2026-10-04 22:36:44',
    boardName: '공지',
    contents: [
      '릴파님의 콘텐츠에 진드기 팀으로 지원합니다.',
      '아직 합격이나 참가 확정이 난 것은 아닙니다.'
    ].join('\n'),
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/4/26300024/75071791120962807.png'
  }
], '진드기', 'jangjh5409');
assert.equal(
  actualJindeugiApplication,
  null,
  'enrichment must not resurrect an unconfirmed application to another broadcaster content'
);

const aiTravelThumbnailPost = batch._internals.strictCrewPost({
  id: '208887277',
  station: 'yaya1787',
  authorId: 'dohnoya',
  author: '호냥20000봐!',
  title: '[AI] 진드기 단체 일본 여행 썸네일 도전!',
  originalTitle: '[AI] 진드기 단체 일본 여행 썸네일 도전!',
  publishedAt: '2026-10-04 19:25:49',
  boardName: '🖥️AI 게시판',
  accessType: 'public',
  contents: '진드기 여행\n다시보기 링크',
  imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/7/26598697/21061791109544115.png'
}, '진드기', 'yaya1787');
assert.equal(
  aiTravelThumbnailPost,
  null,
  'an AI-thumbnail/replay post after a crew trip must not replace the actual trip announcement as latest crew news'
);

const jujukGuestPlanningPost = enrichment.synthesizeCrewEvent([
  {
    id: '208964241',
    station: 'yjkim5500',
    authorId: 'may9999',
    author: '양양2_',
    title: '방송에서 조적단 컨텐츠소통하시는 뮤즈님',
    originalTitle: '방송에서 조적단 컨텐츠소통하시는 뮤즈님',
    publishedAt: '2026-10-05 15:05:36',
    boardName: '🤣 조이봤',
    contents: [
      '내용은 확정은아니구 수정될수있음',
      '대결이 로할거 고민중이신듯',
      '조적단 단톡에도 하자고 남기신거같네요'
    ].join('\n'),
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/7/2591017/59561791180290685.png'
  }
], '조적단', 'yjkim5500');
assert.equal(
  jujukGuestPlanningPost,
  null,
  'a non-member guest post on the leader board about an explicitly unconfirmed plan must not become official crew news'
);

const memberUnconfirmedPlan = batch._internals.strictCrewPost({
  id: 'member-unconfirmed-plan',
  station: '030jjj',
  authorId: '030jjj',
  author: '리타',
  title: '조적단 콘텐츠 기획',
  originalTitle: '조적단 콘텐츠 기획',
  publishedAt: '2026-10-05 16:00:00',
  boardName: '공지사항',
  accessType: 'public',
  contents: '아직 확정은 아니고 수정될 수 있습니다. 어떤 대결로 할지 고민중입니다.'
}, '조적단', '030jjj');
assert.equal(
  memberUnconfirmedPlan,
  null,
  'even a real member post must not become representative news while the activity is explicitly only an unconfirmed plan'
);

const merifurryQuestionPost = enrichment.synthesizeCrewEvent([
  {
    id: '208963343',
    station: 'vkzm14',
    authorId: 'ndregon2410',
    author: 'ajdmjukk',
    title: '머리퍼리 관련 질문!',
    originalTitle: '머리퍼리 관련 질문!',
    publishedAt: '2026-10-05 14:51:18',
    boardName: '[자유게시판]',
    contents: '슬요님이랑 친해지기 바래? 컨텐츠 이번 주 안으로 하는걸로 알고 있는데 언제 하신다고 말씀하신 게 있나요??'
  }
], '머리퍼리', 'beemong');
assert.equal(
  merifurryQuestionPost,
  null,
  'a fan question asking when a crew content will happen must not be promoted to representative crew news'
);

const jaraseomExternalMatch = batch._internals.strictCrewPost({
  id: '208880727',
  station: 'dstv',
  authorId: 'dstv',
  author: '빅윈',
  title: '10/4 (일) 오 방 공',
  originalTitle: '10/4 (일) 오 방 공',
  publishedAt: '2026-10-04 18:14:05',
  boardName: '📌공지사항',
  accessType: 'public',
  contents: [
    '7시전에 킵니다!',
    '오늘 감컴vs버보라 우리 자라섬 애들 나갑니다',
    '응원 많이 해주시구용'
  ].join('\n')
}, '자라섬', 'dstv');
assert.ok(jaraseomExternalMatch, 'the leader official notice about members appearing in the match must remain valid crew news');
assert.equal(
  jaraseomExternalMatch.displaySummary,
  '감컴 VS 버보라 출연',
  'an external named match appearance must preserve the event names instead of collapsing to generic 자라섬 대결'
);

console.log('editorial live regressions: ok');
