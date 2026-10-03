'use strict';

const assert = require('node:assert/strict');
const enrichment = require('../lib/event-enrichment.js');

const jojuk = enrichment.synthesizeCrewEvent([
  {
    id:'208675943',
    station:'thswlstjr666',
    authorId:'thswlstjr666',
    title:'오늘은 드디어 VRC 컨텐츠 놀숲합니다',
    publishedAt:'2026-10-02 14:07:45',
    boardName:'✨ 공 지 사 항 ✨',
    contents:[
      '드디어 진행하는 놀숲입니다!',
      '조적단 친구들 이랑 같이 진행합니다',
      '열심히 준비했으니 재미있게 시청바랍니다~',
      '5시에 시작합니다!'
    ].join('\n'),
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/4/16029964/75051790917609278.png',
    sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url=x&fit=sheet'
  }
], '조적단', 'yjkim5500');
assert.ok(jojuk, 'crew evidence on the immediately adjacent continuation line should belong to the same activity block');
assert.equal(jojuk.displaySummary, '조적단 VRC 놀숲');
assert.equal(jojuk.id, '208675943');

const jailSchedule = enrichment.synthesizeCrewEvent([
  {
    id:'208726499',
    station:'8bibian8',
    authorId:'8bibian8',
    title:'10월 첫, 두번째주 일정입니당(추후 추가 수정예정)',
    publishedAt:'2026-10-02 23:46:39',
    boardName:'🔔방송일정🔔',
    contents:[
      '10월2일 금: 수용소 저녁밥 친구들, 피자시뮬레이터',
      '10월3일: 황원태, 조경훈님 가을운동회 면접 + 마크녹화',
      '10월4일: 장지수용소 버싯대(확정x)'
    ].join('\n'),
    imageUrl:''
  }
], '장지수용소', 'iamquaddurup');
assert.equal(jailSchedule, null, 'adjacent crew text on a separately dated schedule row must not leak into another activity');

console.log('adjacent crew context regression: ok');
