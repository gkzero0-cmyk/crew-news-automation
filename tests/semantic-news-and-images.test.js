'use strict';
const assert=require('assert');
const news=require('../internal/crew-news.js')._internals;
const core=require('../internal/crew-news-batch-core.js')._internals;
const enrichment=require('../lib/event-enrichment.js');
const policy=require('../lib/output-policy.js');
const fingerprint=payload=>JSON.stringify(payload);
const apply=p=>policy.applyOutputPolicy(p,{stableFingerprint:fingerprint,blankUrl:policy.DEFAULT_BLANK_SHEET_IMAGE_URL});

{
  const originalTitle='10/18 일본 라면 시뮬레이터 오후4시 시작';
  const post={id:'209692283',originalTitle,title:originalTitle,contents:'5명 모집합니다',imageUrl:'',station:'243000'};
  const payload={ok:true,strictCrew:'천타버스',selected:{...post,summary:'모집',displaySummary:'천타버스 모집',activityDate:'2026-10-18'},results:[{posts:[post]}]};
  const out=apply(payload);
  assert.strictEqual(out.selected.displayText,'천타버스 - 일본 라면 시뮬레이터 참가자 모집 (10/18) 📌');
  assert.doesNotMatch(out.selected.displayText,/천타버스 - 모집/);
}
{
  const title='10월16일 오후5시 모카의 주술회전 설명회';
  const post={id:'209719957',title,originalTitle:title,contents:'2시간 정도 소요된다고 합니다 많관부',boardName:'🎫 천타버스',accessType:'public',publishedAt:'2026-10-13 21:45:30',authorId:'243000',imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/3/12240993/62921791895480429.png'};
  const eligible=core.strictCrewPost(post,'천타버스','243000');
  assert.ok(eligible,'concrete official lecture should be allowed');
  const out=apply({ok:true,strictCrew:'천타버스',selected:{...eligible,id:post.id,summary:eligible.strictActivity,activityDate:'2026-10-16'},results:[{posts:[post]}]});
  assert.strictEqual(out.selected.displayText,'천타버스 - 모카의 주술회전 설명회 (10/16) 📌');
}
{
  const content='오늘 방송 시간은 9시입니다. 시그풍 추가되었습니다! 움짤 프사와 방셀 혜택 안내.\n오늘 밤 10시에 자라섬 로블록스 합방이 있답니다! 방 탈출 한다는데 기대된당';
  const images=[
    'https://stimg.sooplive.com/NORMAL_BBS/5/13217485/91991791884522529.png',
    'https://stimg.sooplive.com/NORMAL_BBS/5/13217485/38801791884560130.png',
    'https://stimg.sooplive.com/NORMAL_BBS/5/13217485/66701791884502268.png'
  ];
  const row={title_no:'209711983',title_name:'261013 오늘',content,reg_date:'2026-10-13 20:25:36',user_id:'star124',bbs_name:'공지사항',photos:images};
  const normalized=news.normalizePost(row,'star124',new Map(),{headers:{host:'crew-news-automation.vercel.app'}});
  assert.strictEqual(normalized.imageCandidateCount,3);
  assert.strictEqual(normalized.imageAmbiguous,true);
  assert.strictEqual(normalized.imageUrl,'','must not pick first personal announcement image');
  assert.strictEqual(normalized.sheetImageUrl,'');
  const description=enrichment.descriptorForPost({...normalized,station:'star124'},'자라섬','dstv');
  assert.ok(description,'crew Roblox announcement stays eligible');
  assert.strictEqual(description.activity,'로블록스 방탈출 합방');
  assert.strictEqual(description.imageUrl,'');
  const out=apply({ok:true,strictCrew:'자라섬',selected:{...normalized,id:'209711983',summary:'합방',displaySummary:'크루 합방',activityDate:'2026-10-13'},results:[{posts:[normalized]}]});
  assert.strictEqual(out.selected.displayText,'자라섬 - 로블록스 방탈출 합방 (10/13) 📌');
  const unsafeEventVod=apply({ok:true,strictCrew:'자라섬',selected:{id:'209711983',summary:'로블록스 방탈출 합방',displaySummary:'로블록스 방탈출 합방',activityDate:'2026-10-13',imageAmbiguous:true,imageUrl:'https://videoimg.sooplive.com/solo.png',sheetImageUrl:'https://videoimg.sooplive.com/solo.png',imageSource:'leader_vod_same_day'}});
  assert.strictEqual(unsafeEventVod.selected.imageUrl,'');
  assert.match(unsafeEventVod.selected.imageSelectionReason,/복합 공지/);
}
{
  const p={ok:true,strictCrew:'진드기',selected:{id:'209685379',summary:'점호',displaySummary:'진드기 점호',activityDate:'2026-10-13',imageUrl:'https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=solo',sheetImageUrl:'https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=solo',imageSource:'member_vod'},results:[{posts:[{id:'209685379',originalTitle:'[10.13] 진드기 점호중!',contents:'점호 참여중임다!'}]}]};
  const out=apply(p);
  assert.strictEqual(out.selected.imageUrl,'');
  assert.strictEqual(out.selected.sheetImageUrl,policy.DEFAULT_BLANK_SHEET_IMAGE_URL);
  assert.match(out.selected.imageSelectionReason,/단체 회의|점호|VOD/);
}
{
  const post={id:'202',title:'정기회의 공지',originalTitle:'정기회의 공지',contents:'머리퍼리 정기회의',imageUrl:''};
  const out=apply({ok:true,strictCrew:'머리퍼리',selected:{id:'202',summary:'정기회의',displaySummary:'머리퍼리 정기회의',activityDate:'2026-10-12'},results:[{posts:[post]}]});
  assert.strictEqual(out.selected.displayText,'머리퍼리 - 정기회의 (10/12) 📌');
}
// 10/13 was Roblox escape-room collab, not a 10/11 football internal match
// merely published after midnight on 10/12.
{
  const notice={id:'209697679',originalTitle:'오뱅공',title:'오뱅공',contents:'오늘은 10시에 자라섬 로볼록스 합방이 있습니다!',publishedAt:'2026-10-13 17:42:33',activityDate:'2026-10-13'};
  const partner={id:'209711983',originalTitle:'261013 오늘',contents:'오늘 밤 10시에 자라섬 로블록스 합방이 있답니다! 방 탈출 한다는데 기대된당',publishedAt:'2026-10-13 20:25:36',activityDate:'2026-10-13'};
  const payload={ok:true,strictCrew:'자라섬',selected:{...notice,summary:'합방',displaySummary:'크루 합방',activityDate:'2026-10-13',imageUrl:'https://stimg.sooplive.com/first.png',imageSource:'post_self'},results:[{station:'star124',posts:[partner]}]};
  const out=apply(payload);
  assert.strictEqual(out.selected.displayText,'자라섬 - 로블록스 방탈출 합방 (10/13) 📌');
  assert.strictEqual(out.selected.summary,'로블록스 방탈출 합방');
  assert.strictEqual(require('../api/crew-news-batch.js')._internals.shouldAttemptVodConsensus(out,new Date('2026-10-13T13:00:00Z')),false,'specific published game must not be overridden by generic VOD consensus');
  assert.strictEqual(require('../api/crew-news-batch.js')._internals.contradictsSelectedEvent(payload,{signature:'football:3:3:내전'}),true,'Roblox post must never become a football VOD title');
  const withoutPartner=apply({...payload,results:[]});
  assert.strictEqual(withoutPartner.selected.displayText,'자라섬 - 로블록스 합방 (10/13) 📌','game itself is still explicit even if detail cannot be verified');
}
// 2026-10-14: '친구들 로블록스에 영입시킨거' is a metaphor in a
// post-event personal recap, not a new member being recruited to 자라섬.
{
  const post={
    id:'209749253',title:'너무 재밌당',originalTitle:'너무 재밌당',
    authorId:'ioocom',publishedAt:'2026-10-14 02:35:43',
    boardName:'💜뚜 공지💜',accessType:'public',
    contents:'ㅋㅋㅋㅋ\n아 오늘 로블록스 너무 재밌었다\n자라섬 친구들 로블록스에 영입시킨거 나이챠\n오늘 지각했는데 미안합니다ㅠㅠ\n목요일에 보자 ❤️',
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/8/861438/59621791912830111.png'
  };
  assert.strictEqual(core.isMetaphoricalGameRecruitment(post.contents),true);
  assert.strictEqual(core.isPersonalAfterEventReflection(post.originalTitle,post.contents),true);
  assert.strictEqual(core.strictCrewPost(post,'자라섬','ioocom'),null,
    'newer recap must not override 10/13 Roblox escape-room with bogus 10/14 recruitment');
  const actualMemberNotice={...post,id:'valid-hire',originalTitle:'자라섬 신규 크루원 영입',title:'자라섬 신규 크루원 영입',
    contents:'신규 크루원 한 명을 자라섬에 정식 영입했습니다.'};
  assert.strictEqual(core.isMetaphoricalGameRecruitment(actualMemberNotice.contents),false);
  assert.ok(core.strictCrewPost(actualMemberNotice,'자라섬','ioocom'),
    'genuine roster recruitment is still an eligible achievement');
  const eventNotice={...post,id:'209697679',originalTitle:'오뱅공',title:'오뱅공',
    contents:'오늘 밤 10시에 자라섬 로볼록스 합방이 있습니다!'};
  assert.ok(core.strictCrewPost(eventNotice,'자라섬','ioocom'),
    'real new collaboration remains eligible');
  const completedCollab={...post,id:'after-party',originalTitle:'너무 즐거웠어요',title:'너무 즐거웠어요',
    contents:'어제 자라섬 합방 너무 재밌었다. 다들 고생했어.'};
  assert.strictEqual(core.strictCrewPost(completedCollab,'자라섬','ioocom'),null,
    'completed event personal reflections should not become fresh news');
}
console.log('semantic news and image policy regressions: ok');
