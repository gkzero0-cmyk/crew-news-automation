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
  assert.strictEqual(out.selected.id,'209697679','official announcement remains the news source');
  assert.strictEqual(out.selected.imageUrl,'','unverified Roblox event images must not be shown');
  assert.strictEqual(out.selected.sheetImageUrl,policy.DEFAULT_BLANK_SHEET_IMAGE_URL);
  assert.match(out.selected.imageSelectionReason,/방탈출 활동/);
  const previouslyHardcodedRecap=apply({...payload,selected:{
    ...payload.selected,
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/8/861438/59621791912830111.png',
    imageSource:'verified_event_recap',imagePostId:'209749253'
  }});
  assert.strictEqual(previouslyHardcodedRecap.selected.imageUrl,'','previous hardcoded recap image must be rejected');
  assert.match(previouslyHardcodedRecap.selected.imageSelectionReason,/방탈출 활동/);
  // User-confirmed original poster attached to the selected 10/13 notice
  // should be displayed; do not conflate it with the 10/14 recap image.
  const sourcePoster='https://stimg.sooplive.com/NORMAL_BBS/7/26725487/32271791880950927.png';
  const original=apply({...payload,selected:{
    ...payload.selected,postUrl:'https://www.sooplive.com/station/dotcha/post/209697679',
    imageUrl:sourcePoster,sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url='+encodeURIComponent(sourcePoster)+'&fit=sheet',
    imageCandidateCount:1,imageAmbiguous:false,imageSource:'post_self',imagePostId:'209697679'
  }});
  assert.strictEqual(policy.isSelectedEventPoster(original),true);
  assert.strictEqual(original.selected.imageUrl,sourcePoster);
  assert.match(original.selected.imageSelectionReason,/원문 게시글/);
  assert.strictEqual(original.selected.imagePostId,'209697679');
  const wrongPost=apply({...payload,selected:{...original.selected,imagePostId:'209749253'}});
  assert.strictEqual(wrongPost.selected.imageUrl,'','wrong post origin is still blocked');
  const wrongSource=apply({...payload,selected:{...original.selected,imageSource:'verified_event_recap'}});
  assert.strictEqual(wrongSource.selected.imageUrl,'','recap source cannot masquerade as original poster');
  const confirmed=apply({...payload,selected:{...payload.selected,imageVisualVerified:true}});
  assert.strictEqual(confirmed.selected.imageUrl,'https://stimg.sooplive.com/first.png','separately visually verified image may be accepted');
  const anotherEvent=apply({...payload,selected:{...payload.selected,id:'other-robl',activityDate:'2026-10-14'}});
  assert.strictEqual(anotherEvent.selected.imageUrl,'https://stimg.sooplive.com/first.png','unrelated event is not affected by this verified-mismatch block');
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
  const parsed=enrichment.descriptorForPost({...completedCollab,station:'ioocom',authorId:'ioocom'},'자라섬','dstv');
  assert.strictEqual(parsed,null,'event-enrichment path must not promote a completed-collab recap either');
  const completedWithNewNotice={...completedCollab,id:'recap-and-new',contents:'어제 자라섬 합방 너무 재밌었다. 내일 자라섬 정기회의 진행 예정입니다.'};
  assert.ok(enrichment.descriptorForPost({...completedWithNewNotice,station:'ioocom',authorId:'ioocom'},'자라섬','dstv'),
    'a separately announced future event should remain eligible despite a personal recap');
}

// Real SOOP image discovered after the sheet slot was empty. Its source URI
// must be converted into a displayable Sheets proxy without changing its
// original evidence or promoting an unrelated member's thumbnail.
{
  const realImage='https://stimg.sooplive.com/NORMAL_BBS/1/123/confirmed_event.png';
  const base={ok:true,strictCrew:'조적단',selected:{
    id:'selected-event',summary:'미스테리',displaySummary:'미스테리',
    activityDate:'2026-10-15',imageUrl:realImage,sheetImageUrl:'',
    imageSource:'post_self'
  },results:[{posts:[{id:'selected-event',originalTitle:'조적단 미스테리',imageUrl:realImage,contents:'오늘 조적단 미스테리 진행'}]}]};
  const out=apply(base);
  const expected='https://crew-news-automation.vercel.app/api/image?url='+encodeURIComponent(realImage)+'&fit=sheet';
  assert.strictEqual(out.selected.imageUrl,realImage);
  assert.strictEqual(out.selected.sheetImageUrl,expected,'a real image must not remain invisible in an empty Sheets cell');
  const final=policy.applyFinalImageSafety(
    {...base,selected:{...base.selected}}, {stableFingerprint:fingerprint}
  );
  assert.strictEqual(final.selected.sheetImageUrl,expected,'post-consensus finalization also repairs missing sheet URLs');
  const unsafe=apply({...base,selected:{...base.selected,
    imageUrl:'https://untrusted.example/remote.png'}});
  assert.strictEqual(unsafe.selected.sheetImageUrl,'',
    'do not proxy an unapproved image origin');
  const noImage=apply({...base,selected:{...base.selected,imageUrl:'',sheetImageUrl:'',imageSource:'none'}});
  assert.strictEqual(noImage.selected.sheetImageUrl,policy.DEFAULT_BLANK_SHEET_IMAGE_URL,
    'no matching real image must issue a proper clear instruction');
}


{
  const poster='https://stimg.sooplive.com/NORMAL_BBS/8/25819298/35631791973160029.jpeg';
  const core={ok:true,strictCrew:'ZZAM지트',selected:{
    id:'209792173',summary:'Trash Day 합방',displaySummary:'Trash Day 합방',
    activityDate:'2026-10-14',imageUrl:'',sheetImageUrl:'',imageSource:'none'
  },mediaCandidates:[{id:'209793809',station:'sagesv',authorId:'sagesv',
    title:'261014 수요일 !',originalTitle:'261014 수요일 !',
    contents:'오늘밤 8시부터 Trash Day 합방(w. 루센, 햄쏘따, 우냥, 꼬마거북이)',
    publishedAt:'2026-10-14 19:19:43',imageUrl:poster,imageCandidateCount:1}]};
  const good=apply(core);
  assert.strictEqual(good.selected.imageUrl,poster,'valid same-event game art fills empty image slot');
  assert.strictEqual(good.selected.imageSource,'post_member');
  assert.strictEqual(good.selected.imagePostId,'209793809');
  assert.match(good.selected.sheetImageUrl,/\/api\/image\?url=/);
  const wrong=apply({...core,mediaCandidates:[{...core.mediaCandidates[0],id:'other',
    title:'PEAK 합방',contents:'오늘 PEAK 합방'}]});
  assert.strictEqual(wrong.selected.imageUrl,'','different game image cannot fill slot');
  const selfie=apply({...core,mediaCandidates:[{...core.mediaCandidates[0],id:'selfie',
    title:'셀카',contents:'오늘 밤 Trash Day 합방'}]});
  assert.strictEqual(selfie.selected.imageUrl,'','personal selfie is excluded');
  const wrongDay=apply({...core,mediaCandidates:[{...core.mediaCandidates[0],id:'next',
    publishedAt:'2026-10-15 19:19:43'}]});
  assert.strictEqual(wrongDay.selected.imageUrl,'','other dates cannot be reused');
}
{
  const url='https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20261004_1279B109_297581563_1_r&column=2&t=1791104356';
  const actual=apply({ok:true,strictCrew:'장지수용소',selected:{
    id:'208932989',summary:'나들이',displaySummary:'나들이',activityDate:'2026-10-05',
    imageUrl:url,sheetImageUrl:url,imageSource:'leader_vod_editorial'
  }});
  assert.strictEqual(actual.selected.imageUrl,'','visually unrelated VOD frame removed');
  assert.strictEqual(actual.selected.sheetImageUrl,policy.DEFAULT_BLANK_SHEET_IMAGE_URL);
  assert.match(actual.selected.imageSelectionReason,/다른 회차/);
}

console.log('semantic news and image policy regressions: ok');
