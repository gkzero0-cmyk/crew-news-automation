'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const enrichment = require('../lib/event-enrichment.js');

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

const externalInterviewRecap = enrichment.synthesizeCrewEvent([
  {
    id: '208811011',
    station: 'sunza1122',
    authorId: 'sunza1122',
    title: '장지수용소 포포입니다',
    originalTitle: '장지수용소 포포입니다',
    publishedAt: '2026-10-03 22:02:09',
    boardName: '포포 일기장 👾',
    contents: [
      '장지수용소 면접',
      '오늘 원태님 방송에서 면접 보고 왔습니다!',
      '우리 장지수용소 다 잘 한거 같나용',
      '방송 끝나고 원태님이 고기 사주셔서 맛있게 먹었습니다.',
      '내일 집 도착하자마자 방송 잠깐 킬게용!!'
    ].join('\n'),
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/0/28636980/63361791032301700.jpeg'
  }
], '장지수용소', 'iamquaddurup');
assert.equal(
  externalInterviewRecap,
  null,
  'a member recap about appearing on another broadcaster\'s interview must not be promoted to an official crew event'
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

function runImageResetScenario() {
  const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
  let imageCleared = false;
  const currentUrl = 'https://www.sooplive.com/station/hwayang3/post/208597179';
  const currentText = '강씨세가 - 강씨세가 미스테리 w. 화양 (10/1) 📌';
  const oldFormula = '=IMAGE("https://old.example/anniversary.jpg",1)';
  const props = {};

  const newsRange = {
    getDisplayValue: () => currentText,
    getRichTextValue: () => ({getLinkUrl: () => currentUrl, getRuns: () => []}),
    setRichTextValue: () => newsRange,
    setHorizontalAlignment: () => newsRange,
    setVerticalAlignment: () => newsRange
  };
  const imageRange = {
    getFormula: () => oldFormula,
    clearContent: () => { imageCleared = true; return imageRange; },
    getRow: () => 26,
    getNumRows: () => 1,
    getColumn: () => 11,
    getNumColumns: () => 1
  };
  const imageBlock = {
    getRow: () => 26,
    getNumRows: () => 7,
    getColumn: () => 11,
    getNumColumns: () => 4
  };
  const sheet = {
    getRange: a1 => a1 === 'I4' ? newsRange : (a1 === 'K26:N32' ? imageBlock : imageRange),
    getImages: () => []
  };
  const ctx = vm.createContext({
    console, Date, JSON, Object, String, Array,
    SpreadsheetApp: {
      newTextStyle: () => ({setFontFamily(){return this;},setFontSize(){return this;},setBold(){return this;},setForegroundColor(){return this;},setUnderline(){return this;},build(){return {};}}),
      newRichTextValue: () => ({setText(){return this;},setLinkUrl(){return this;},setTextStyle(){return this;},build(){return {};}})
    },
    PropertiesService: {getDocumentProperties: () => ({
      getProperty: key => props[key] || '',
      setProperty: (key, value) => { props[key] = value; },
      deleteProperty: key => { delete props[key]; },
      getKeys: () => Object.keys(props)
    })}
  });
  vm.runInContext(source, ctx);
  const crew = {
    crew: '강씨세가',
    newsCell: 'I4',
    imageCell: 'K26',
    imageRange: 'K26:N32',
    color: '#dab04d',
    members: [{station:'rkdakstlr911'}, {station:'hwayang3'}]
  };
  const payload = {
    ok: true,
    complete: true,
    reliableEmpty: false,
    preservePrevious: false,
    healthStatus: 'healthy',
    policyVersion: 'test-policy',
    selectedFingerprint: 'new-fp',
    shouldWrite: false,
    unchanged: true,
    updateAction: 'skip_unchanged',
    results: [],
    selected: {
      id: '208597179',
      station: 'hwayang3',
      postUrl: currentUrl,
      displayText: currentText,
      displayDate: '10/1',
      activityDate: '2026-10-01',
      sourcePublishedAt: '2026-10-01 18:41:35',
      imageUrl: '',
      sheetImageUrl: '',
      imageSource: 'none',
      fingerprint: 'new-fp',
      isCrewLeader: false
    }
  };
  const result = ctx.refreshOneCrew_(sheet, crew, payload, {batchRequests:0,fallbackRequests:0});
  return {imageCleared, result};
}

const reset = runImageResetScenario();
assert.equal(
  reset.imageCleared,
  true,
  'when a healthy verified new event has no suitable image, a stale image from the previous event must be cleared'
);
assert.equal(reset.result.imageState, '이미지 없음');

console.log('crew-news qualification/image reset regression: ok');
