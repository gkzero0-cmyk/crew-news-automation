'use strict';

const assert=require('assert');
const policy=require('../lib/output-policy.js');

function stableFingerprint(input) {
  return JSON.stringify(input);
}

function apply(payload) {
  return policy.applyOutputPolicy(payload,{
    blankUrl:'https://crew-news-automation.vercel.app/api/blank-image',
    stableFingerprint
  });
}

{
  const payload={
    ok:true,
    strictCrew:'천타버스',
    previousFingerprint:'old',
    selected:{
      id:'208887819',
      summary:'모집',
      displaySummary:'천타버스 모집',
      displayText:'천타버스 - 천타버스 모집 (10/15) 📌',
      displayDate:'10/15',
      activityDate:'2026-10-15',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'208887819',
      originalTitle:'10/15 뇌피셜 게임 참가자 모집',
      contents:'천타버스 내수 콘텐츠 뇌피셜 게임 7명 모집'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'뇌피셜 게임');
  assert.equal(out.selected.displaySummary,'뇌피셜 게임');
  assert.equal(out.selected.displayText,'천타버스 - 뇌피셜 게임 (10/15) 📌');
  assert.equal(out.selected.sheetImageUrl,'https://crew-news-automation.vercel.app/api/blank-image');
  assert.equal(out.shouldWrite,true);
  assert.equal(out.unchanged,false);
}

{
  const payload={
    ok:true,
    strictCrew:'장지수용소',
    selected:{
      id:'208932989',
      summary:'합방',
      displaySummary:'장지수용소 합방',
      displayDate:'10/5',
      activityDate:'2026-10-05',
      imageUrl:'https://example.com/naduri.jpg',
      sheetImageUrl:'https://example.com/naduri.jpg'
    },
    results:[{posts:[{
      id:'208932989',
      originalTitle:'장지수용소 합방',
      contents:'오늘은 장지수용소 나들이'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'나들이');
  assert.equal(out.selected.displayText,'장지수용소 - 나들이 (10/5) 📌');
  assert.equal(out.selected.sheetImageUrl,'https://example.com/naduri.jpg');
}

{
  const payload={
    ok:true,
    strictCrew:'테스트크루',
    selected:{
      id:'1',
      summary:'모집',
      displaySummary:'테스트크루 모집',
      activityDate:'2026-10-06',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'1',
      originalTitle:'신규 크루원 모집',
      contents:'테스트크루 신입 멤버 모집'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'모집');
  assert.equal(out.selected.displayText,'테스트크루 - 모집 (10/6) 📌');
}

{
  const result=policy.ensureBlankImageDirective({
    ok:true,
    strictCrew:'테스트',
    selected:{imageUrl:'https://example.com/current.jpg',sheetImageUrl:'https://example.com/current.jpg'}
  });
  assert.equal(result.changed,false);
  assert.equal(result.payload.selected.sheetImageUrl,'https://example.com/current.jpg');
}

console.log('output-policy regression tests passed');
