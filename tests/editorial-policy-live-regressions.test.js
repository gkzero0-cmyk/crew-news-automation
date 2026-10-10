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


const jindeugiPersonalBersudaPost = batch._internals.strictCrewPost({
  id: '209230045',
  station: 'mingkymya',
  authorId: 'mingkymya',
  author: '이루희',
  title: '10/09(금) 14시::버수다 극혐 맞춤법 월드컵 편 w.반타',
  originalTitle: '10/09(금) 14시::버수다 극혐 맞춤법 월드컵 편 w.반타',
  publishedAt: '2026-10-08 16:50:12',
  boardName: '🛸:: 콘텐츠공지',
  accessType: 'public',
  contents: [
    '루-하!',
    '추석과 진드기 일본여행으로 인해 쉬어갔던 버수다가 다시 돌아왔습니다!!',
    '버수다 3번째 주제는 바로바로 한글날 기념 극혐 맞춤법 월드컵-!',
    '요번에는 습창단 갱갱수월래로 연이 닿아',
    '오랫동안 서로의 육수로 남아있는 반타와 함께 합니다 !!!'
  ].join('\n'),
  imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/0/25795650/91871791445360702.png'
}, '진드기', 'mingkymya');

assert.equal(
  jindeugiPersonalBersudaPost,
  null,
  'a member personal content post must not become crew news when the crew is mentioned only as past background context'
);

assert.equal(
  batch._internals.detectActivity('습창단 갱갱수월래로 연이 닿아'),
  '',
  '창단 must not match as a substring inside an unrelated proper name'
);


const jangjiExternalSupportPost = batch._internals.strictCrewPost({
  id:'209390327',
  station:'iamquaddurup',
  authorId:'iamquaddurup',
  author:'장지수',
  title:'세구님 콘텐츠',
  originalTitle:'오늘',
  publishedAt:'2026-10-10 09:56:13',
  boardName:'🌎공지',
  accessType:'public',
  contents:[
    '형님들 장지수용소 애들 요즘 열심히하는데',
    '추천 한번씩만 부탁드리겠습니다',
    '세구님 콘텐츠 커트라인 근처레용!!',
    '시몽 https://www.sooplive.com/station/gosegu2/post/208975797#comment_noti122712541',
    '후룽카카 https://www.sooplive.com/station/gosegu2/post/208975797#comment_noti122707011'
  ].join('\n'),
  imageUrl:'https://example.com/external-support.jpeg'
}, '장지수용소', 'iamquaddurup');

assert.equal(
  jangjiExternalSupportPost,
  null,
  'external-content recommendation/support promotion before selection confirmation must not become representative crew news'
);

const confirmedExternalParticipation = batch._internals.strictCrewPost({
  id:'confirmed-external-content',
  station:'iamquaddurup',
  authorId:'iamquaddurup',
  author:'장지수',
  title:'세구님 콘텐츠 최종 합격 확정',
  originalTitle:'세구님 콘텐츠 최종 합격 확정',
  publishedAt:'2026-10-10 12:00:00',
  boardName:'🌎공지',
  accessType:'public',
  contents:'장지수용소 멤버가 세구님 콘텐츠에 최종 합격되었습니다. 참가 확정!',
  imageUrl:'https://example.com/confirmed.jpeg'
}, '장지수용소', 'iamquaddurup');

assert.ok(
  confirmedExternalParticipation,
  'confirmed external-content participation must remain eligible crew news'
);

console.log('editorial live regressions: ok');
