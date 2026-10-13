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
  assert.equal(out.selected.displaySummary,'장지수용소 나들이');
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
  const payload={
    ok:true,
    strictCrew:'천타버스',
    selected:{
      id:'old-concrete',
      summary:'천타버스 추석특집',
      displaySummary:'천타버스 추석특집',
      displayDate:'9/26',
      activityDate:'2026-09-26',
      imageUrl:'https://example.com/chuseok.jpg',
      sheetImageUrl:'https://example.com/chuseok.jpg'
    },
    results:[{posts:[{
      id:'old-concrete',
      originalTitle:'천타버스 추석특집',
      contents:'천타버스 추석특집 진행합니다'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.displaySummary,'천타버스 추석특집');
  assert.equal(out.selected.displayText,'천타버스 - 추석특집 (9/26) 📌');
}

{
  const payload={
    ok:true,
    strictCrew:'천타버스',
    selected:{
      id:'209091397',
      summary:'합격',
      displaySummary:'천타버스 합격',
      displayDate:'10/6',
      activityDate:'2026-10-06',
      imageUrl:'https://example.com/curling.png',
      sheetImageUrl:'https://example.com/curling.png'
    },
    results:[{posts:[{
      id:'209091397',
      originalTitle:'릴파의 VR 포인트 컬링 대회 출전 합격을 축하합니다!',
      contents:'우승 가즈아ㅏㅏㅏㅏㅏㅏㅏㅏ'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'릴파의 VR 포인트 컬링 대회 출전 합격 축하');
  assert.equal(out.selected.displaySummary,'릴파의 VR 포인트 컬링 대회 출전 합격 축하');
  assert.equal(out.selected.displayText,'천타버스 - 릴파의 VR 포인트 컬링 대회 출전 합격 축하 (10/6) 📌');
  assert.equal(out.selected.sheetImageUrl,'https://example.com/curling.png');
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


{
  const payload={
    ok:true,
    strictCrew:'ZZAM지트',
    selected:{
      id:'209239633',
      summary:'합방',
      displaySummary:'합방',
      displayDate:'10/8',
      activityDate:'2026-10-08',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'209239633',
      originalTitle:'📺2026.10.08 방송공지',
      contents:'오늘은 저녁 8시 ZZAM지트에서 PEAK 합방 갑니다!! 숙봉, 루센, 나나, 에이레네 이렇게 4명이서 가요~'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'PEAK 합방');
  assert.equal(out.selected.displaySummary,'PEAK 합방');
  assert.equal(out.selected.displayText,'ZZAM지트 - PEAK 합방 (10/8) 📌');
}


{
  const payload={
    ok:true,
    strictCrew:'천타버스',
    selected:{
      id:'209347109',
      summary:'대회',
      displaySummary:'대회',
      displayDate:'10/9',
      activityDate:'2026-10-09',
      imageUrl:'https://example.com/curling-winner.png',
      sheetImageUrl:'https://example.com/curling-winner.png'
    },
    results:[{posts:[{
      id:'209347109',
      originalTitle:'릴파 컬링대회 "뎅꿀팀" 달타의 우승을 축하합니다!!!',
      contents:'F1보면서도 할건 해야지 우리달타 ㅊㅊ'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'릴파 컬링대회 "뎅꿀팀" 달타 우승 축하');
  assert.equal(out.selected.displaySummary,'릴파 컬링대회 "뎅꿀팀" 달타 우승 축하');
  assert.equal(out.selected.displayText,'천타버스 - 릴파 컬링대회 "뎅꿀팀" 달타 우승 축하 (10/9) 📌');
}


for (const [crew, current, expected] of [
  ['진드기','진드기 합격','진드기 - SBO 합격 축하 (10/10) 📌'],
  ['천타버스','천타버스 합격','천타버스 - SBO 합격 축하 (10/10) 📌']
]) {
  const payload={
    ok:true,
    strictCrew:crew,
    selected:{
      id:crew==='진드기'?'209450769':'209448537',
      summary:'합격',
      displaySummary:current,
      displayDate:'10/10',
      activityDate:'2026-10-10',
      imageUrl:'https://example.com/sbo.png',
      sheetImageUrl:'https://example.com/sbo.png'
    },
    results:[{posts:[{
      id:crew==='진드기'?'209450769':'209448537',
      originalTitle:crew==='진드기'?'진드기 SBO 합격 축하 드립니다.':'SBO 합격을 축하합니다',
      contents:crew==='진드기'?'우승 두개자~ 오늘이는 그래도 탈락계 1등이야 고생했어 ^^':'ㅊㅊ'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'SBO 합격 축하');
  assert.equal(out.selected.displaySummary,'SBO 합격 축하');
  assert.equal(out.selected.displayText,expected);
}


{
  const payload={
    ok:true,
    strictCrew:'자라섬',
    selected:{
      id:'209431065',
      summary:'콘텐츠',
      displaySummary:'자라섬 VRC 콘텐츠',
      displayDate:'10/10',
      activityDate:'2026-10-10',
      imageUrl:'https://example.com/jaraseom-vrc.png',
      sheetImageUrl:'https://example.com/jaraseom-vrc.png'
    },
    results:[{posts:[{
      id:'209431065',
      originalTitle:'10/10 (토) 자펠다운: 부르(자라섬 임펠다운이라는뜻)',
      title:'10/10 (토) 자펠다운: 부르(자라섬 임펠다운이라는뜻)',
      contents:'10시 임대오신 부르님과 VRC 자라섬 컨텐츠합니다\n왜 왔는지부터 취조할께요'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'자펠다운: 부르 VRC 콘텐츠');
  assert.equal(out.selected.displaySummary,'자펠다운: 부르 VRC 콘텐츠');
  assert.equal(out.selected.displayText,'자라섬 - 자펠다운: 부르 VRC 콘텐츠 (10/10) 📌');
}

{
  const payload={
    ok:true,
    strictCrew:'테스트크루',
    selected:{
      id:'generic-content-without-name',
      summary:'콘텐츠',
      displaySummary:'콘텐츠',
      displayDate:'10/11',
      activityDate:'2026-10-11',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'generic-content-without-name',
      originalTitle:'오늘 방송 공지',
      contents:'오늘 테스트크루 콘텐츠 진행합니다'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'콘텐츠');
  assert.equal(out.selected.displaySummary,'콘텐츠');
  assert.equal(out.selected.displayText,'테스트크루 - 콘텐츠 (10/11) 📌');
}

{
  const payload={
    ok:true,
    strictCrew:'테스트크루',
    selected:{
      id:'named-collab-generic',
      summary:'합방',
      displaySummary:'합방',
      displayDate:'10/11',
      activityDate:'2026-10-11',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'named-collab-generic',
      originalTitle:'오늘 합방 공지',
      contents:'오늘 저녁 테스트크루에서 R.E.P.O 합방 갑니다'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'R.E.P.O 합방');
  assert.equal(out.selected.displaySummary,'R.E.P.O 합방');
  assert.equal(out.selected.displayText,'테스트크루 - R.E.P.O 합방 (10/11) 📌');
}

{
  const payload={
    ok:true,
    strictCrew:'테스트크루',
    selected:{
      id:'named-acronym-qualification',
      summary:'합격',
      displaySummary:'합격',
      displayDate:'10/11',
      activityDate:'2026-10-11',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'named-acronym-qualification',
      originalTitle:'ABC 합격을 축하합니다',
      contents:'테스트크루 멤버의 ABC 합격을 축하합니다'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'ABC 합격 축하');
  assert.equal(out.selected.displaySummary,'ABC 합격 축하');
  assert.equal(out.selected.displayText,'테스트크루 - ABC 합격 축하 (10/11) 📌');
}


{
  const payload={
    ok:true,
    strictCrew:'자라섬',
    selected:{
      id:'209518583',
      summary:'합방',
      displaySummary:'합방',
      displayDate:'10/11',
      activityDate:'2026-10-11',
      imageUrl:'',
      sheetImageUrl:''
    },
    results:[{posts:[{
      id:'209518583',
      originalTitle:'오누레 공쥬ㅣ',
      contents:'오늘은 자라섬 합방을 키보드로 해야될 것 같습니댱. 10시에 콘텐츠 할개욤'
    }]}]
  };
  const out=apply(payload);
  assert.equal(out.selected.summary,'크루 합방');
  assert.equal(out.selected.displaySummary,'크루 합방');
  assert.equal(out.selected.displayText,'자라섬 - 크루 합방 (10/11) 📌');
}

// Exact-post winner confirmation: do not describe an entrant as an organizer.
{
  const p={ok:true,strictCrew:'천타버스',selected:{id:'209626205',summary:'대회',displaySummary:'모카의 버추얼 J-POP 푹먹노래대회',activityDate:'2026-10-12',imageUrl:'https://example.com/poster.png',sheetImageUrl:'https://example.com/poster.png',imageSource:'post_self'},results:[{posts:[{id:'209626205',originalTitle:'모카의 버추얼 J-POP 푹먹노래대회',contents:'대회 포스터'}]}]};
  const out=apply(p);
  assert.equal(out.selected.displayText,'천타버스 - 모카 J-POP 노래대회 우승 (10/12) 📌');
  assert.equal(out.selected.imageUrl,'');
  assert.equal(out.selected.sheetImageUrl,policy.DEFAULT_BLANK_SHEET_IMAGE_URL);
  assert.match(out.selected.imageSelectionReason,/우승/);
}
// The actual official winner congratulation post includes its own image.
{
  const url='https://stimg.sooplive.com/NORMAL_BBS/3/12240993/67921791804764247.png';
  const p={ok:true,strictCrew:'천타버스',selected:{id:'209626205',summary:'대회',displaySummary:'모카의 버추얼 J-POP 푹먹노래대회',activityDate:'2026-10-12',imageUrl:url,sheetImageUrl:url,imageSource:'post_self'},results:[{posts:[{id:'209626205',originalTitle:'모카의 버추얼 J-POP 푹먹노래대회 우승을 축하합니다!',imageUrl:url,contents:''}]}]};
  const out=apply(p);
  assert.equal(out.selected.displayText,'천타버스 - 모카 J-POP 노래대회 우승 (10/12) 📌');
  assert.equal(out.selected.imageUrl,url,'actual official congratulation image must not be cleared');
  assert.equal(out.selected.sheetImageUrl,url);
  const mismatched=apply({...p,selected:{...p.selected,imageUrl:'https://example.com/different.jpg',sheetImageUrl:'https://example.com/different.jpg'}});
  assert.equal(mismatched.selected.imageUrl,'','image sourced from a different post remains unverified');
  const vod=apply({...p,selected:{...p.selected,imageSource:'member_vod'}});
  assert.equal(vod.selected.imageUrl,'','a generic VOD thumbnail is not a verified congratulation image');
}
// Entering or hoping to win a different event is not a verified victory.
{
  const p={ok:true,strictCrew:'천타버스',selected:{id:'209616935',summary:'대회',displaySummary:'J-POP 노래대회',activityDate:'2026-10-12',imageUrl:'',sheetImageUrl:''},results:[{posts:[{id:'209616935',originalTitle:'J-POP 대회 참가',contents:'우승하면 좋겠다'}]}]};
  const out=apply(p);
  assert.doesNotMatch(out.selected.displayText,/우승/);
}
// A member's solo avatar VOD is not verified group-meeting imagery.
{
  const p={ok:true,strictCrew:'머리퍼리',selected:{id:'209617403',summary:'회의',displaySummary:'머리퍼리 회의',activityDate:'2026-10-12',imageUrl:'https://example.com/solo-avatar.jpg',sheetImageUrl:'https://example.com/solo-avatar.jpg',imageSource:'member_vod'},results:[{posts:[{id:'209617403',originalTitle:'머리퍼리 회의',contents:'크루 회의 합니다'}]}]};
  const out=apply(p);
  assert.equal(out.selected.imageUrl,'');
  assert.equal(out.selected.sheetImageUrl,policy.DEFAULT_BLANK_SHEET_IMAGE_URL);
  assert.match(out.selected.imageSelectionReason,/단체 회의/);
  const verified=apply({...p,selected:{...p.selected,imageVerifiedGroup:true}});
  assert.equal(verified.selected.imageUrl,'https://example.com/solo-avatar.jpg');
}
// The selected 10/8 four-person PEAK notice and verified overnight replay match.
{
  const p={ok:true,strictCrew:'ZZAM지트',selected:{id:'209239633',summary:'PEAK 합방',displaySummary:'PEAK 합방',activityDate:'2026-10-08',imageUrl:'',sheetImageUrl:''},results:[{posts:[{id:'209239633',originalTitle:'📺2026.10.08 방송공지',contents:'오늘은 ZZAM지트 PEAK 합방 갑니다! 숙봉, 루센, 냐냐, 에이레네 4명이서 갑니다!'}]}]};
  const out=apply(p);
  assert.equal(out.selected.imageSource,'member_vod_verified');
  assert.match(out.selected.imageUrl,/20261008_E2D1DE2F_297687015_1_r/);
  assert.equal(out.selected.fallbackVodUrl,'https://vod.sooplive.com/player/209278713');
  const unrelated=apply({...p,selected:{...p.selected,id:'newer-peek'},results:[{posts:[{id:'newer-peek',contents:'숙봉 루센 냐냐 에이레네 PEAK 합방'}]}]});
  assert.equal(unrelated.selected.imageUrl,'');
  const unconfirmed=apply({...p,results:[{posts:[{id:'209239633',contents:'ZZAM지트 PEAK 합방 숙봉 혼자 갑니다'}]}]});
  assert.equal(unconfirmed.selected.imageUrl,'');
}
console.log('output-policy regression tests passed');
