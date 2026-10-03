'use strict';

const assert = require('node:assert/strict');
const enrichment = require('../lib/event-enrichment.js');
const batch = require('../api/crew-news-batch.js');

const personalCrewMap = enrichment.synthesizeCrewEvent([
  {
    id: '208653645',
    station: 'tleod1818',
    authorId: 'tleod1818',
    title: '레전드 존못게임 와우',
    originalTitle: '레전드 존못게임 와우',
    publishedAt: '2026-10-02 03:08:06',
    boardName: '빙송시간',
    contents: [
      '오늘은 천타버스 긴급 소집맵 할게용!!!',
      '문제를 풀면서 미로를 탈출하는 천양님 콘텐츠 월드인데',
      '저번에 합방이랑 겹쳐서 못한거 오늘 하밍언니랑 합니다!!!!',
      '그리구 끝나고 조금 쉬다가 개인 종겜 하겠습니다.',
      '구럼 저는 내일 오후 5시까지 오도록 하겠습니다!!!!'
    ].join('\n'),
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/9/20708229/81081790878764365.gif'
  }
], '천타버스', '243000');
assert.equal(
  personalCrewMap,
  null,
  'a crew-branded map played as a personal/two-person stream must not become official crew news because an old collab is mentioned in the body'
);

const externalInterviewPayload = {
  ok: true,
  complete: true,
  preservePrevious: false,
  healthStatus: 'healthy',
  strictCrew: '장지수용소',
  selected: {
    id: '208811011',
    summary: '면접',
    displaySummary: '장지수용소 면접',
    activityDate: '2026-10-04',
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/0/28636980/63361791032301700.jpeg'
  },
  results: [{
    station: 'sunza1122',
    ok: true,
    posts: [{
      id: '208811011',
      originalTitle: '장지수용소 포포입니다',
      title: '장지수용소 장지수용소 면접',
      publishedAt: '2026-10-03 22:02:09',
      contents: [
        '장지수용소 면접',
        '오늘 원태님 방송에서 면접 보고 왔습니다!',
        '우리 장지수용소 다 잘 한거 같나용',
        '방송 끝나고 원태님이 고기 사주셔서 맛있게 먹었습니다.',
        '내일 집 도착하자마자 방송 잠깐 킬게용!!'
      ].join('\n')
    }]
  }]
};
assert.equal(
  batch._internals.isExternalParticipationRecapSelected(externalInterviewPayload),
  true,
  'a completed appearance on another broadcaster should invalidate the core crew-event selection'
);
assert.equal(
  batch._internals.shouldAttemptEnrichment(externalInterviewPayload),
  true,
  'an invalid external-participation selection must force raw-post re-evaluation even when it has an image'
);

const sameDayRollCall = enrichment.synthesizeCrewEvent([
  {
    id: 'rollcall-date-scope',
    station: 'member',
    authorId: 'member',
    title: '장지수용소 점호 공지',
    originalTitle: '장지수용소 점호 공지',
    publishedAt: '2026-10-03 16:00:00',
    boardName: '방송 공지',
    contents: [
      '오늘 저녁 8시 장지수용소 점호 있습니다.',
      '수용소 친구들이랑 다 같이 만나요.',
      '내일은 개인 방송 쉽니다.'
    ].join('\n'),
    imageUrl: ''
  }
], '장지수용소', 'iamquaddurup');
assert.ok(sameDayRollCall, 'a direct same-day crew roll call should remain valid');
assert.equal(
  sameDayRollCall.activityDate,
  '2026-10-03',
  'an unrelated later sentence containing 내일 must not move the event date to the next day'
);

const noImageSelected = batch._internals.buildSelected('강씨세가', {
  id: '208597179',
  station: 'hwayang3',
  postUrl: 'https://www.sooplive.com/station/hwayang3/post/208597179',
  activity: '미스테리',
  displaySummary: '강씨세가 미스테리 w. 화양',
  activityDate: '2026-10-01',
  publishedAt: '2026-10-01 18:41:35',
  sourcePublishedAt: '2026-10-01 18:41:35',
  imageUrl: '',
  sheetImageUrl: '',
  imageSource: 'none'
}, 'fp-no-image');
assert.equal(noImageSelected.imageUrl, '', 'the canonical event should still report that it has no representative image');
assert.match(
  noImageSelected.sheetImageUrl,
  /\/api\/blank-image$/,
  'a healthy event with no suitable image must send an explicit blank sheet image so the current Apps Script replaces stale media'
);

console.log('crew-news qualification/image reset regression: ok');
