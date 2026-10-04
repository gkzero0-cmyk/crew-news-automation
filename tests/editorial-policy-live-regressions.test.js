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

console.log('editorial live regressions: ok');
