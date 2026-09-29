'use strict';

const assert=require('assert');
const batch=require('../api/crew-news-batch.js')._internals;
function date(raw,published){ return batch.resolveActivityDateInfo(raw,published); }

assert.deepStrictEqual(date('9월 30일 진드기 여행','2026-09-29 18:00:00'),{date:'2026-09-30',source:'explicit-korean'});
assert.deepStrictEqual(date('9/30 여행 출발','2026-09-29 18:00:00'),{date:'2026-09-30',source:'explicit-slash'});
assert.deepStrictEqual(date('9.30 러닝','2026-09-29 18:00:00'),{date:'2026-09-30',source:'explicit-dot'});
assert.deepStrictEqual(date('2026-09-30 합방','2026-09-29 18:00:00'),{date:'2026-09-30',source:'explicit-iso'});
assert.deepStrictEqual(date('내일 단체 합방','2026-09-29 18:00:00'),{date:'2026-09-30',source:'relative'});
assert.strictEqual(date('3박 4일 여행','2026-09-29 18:00:00').date,'');
assert.strictEqual(batch.resolveActivityDate('1/2 신년 합방','2026-12-31 20:00:00'),'2027-01-02');

assert.strictEqual(batch.vodDetailConsistent(
  {id:'207462085',title:'장지수용소 단체 모임 [무수]'},
  {id:'207462085',title:'장지수용소 단체 모임 [무수]',authorId:'iamquaddurup',imageUrl:'https://videoimg.sooplive.com/example'},
  'iamquaddurup'
),true);
assert.strictEqual(batch.vodDetailConsistent(
  {id:'207462085',title:'장지수용소 단체 모임'},
  {id:'999',title:'장지수용소 단체 모임',authorId:'iamquaddurup',imageUrl:'https://videoimg.sooplive.com/example'},
  'iamquaddurup'
),false);



const hunterPost=batch.strictCrewPost({
  id:'208458625',
  title:'9/30 오후4시 천타버스 vs 버인협회 더헌터 사냥대결',
  originalTitle:'9/30 오후4시 천타버스 vs 버인협회 더헌터 사냥대결',
  author:'천양',
  authorId:'243000',
  publishedAt:'2026-09-30 01:45:38',
  boardName:'🔊 공지사항',
  accessType:'public',
  contents:'',
  imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/example.png',
  sheetImageUrl:'https://stimg.sooplive.com/NORMAL_BBS/example.png'
},'천타버스','243000');

assert.ok(hunterPost,'hunter contest post should be accepted');
assert.strictEqual(hunterPost.representativeTier,1);
assert.strictEqual(hunterPost.activityDate,'2026-09-30');
assert.strictEqual(
  hunterPost.displaySummary,
  '천타버스 VS 버인협회 더헌터 사냥대결'
);
assert.strictEqual(
  batch.finalDisplayText(hunterPost,'천타버스'),
  '천타버스 - 천타버스 VS 버인협회 더헌터 사냥대결 (9/30) 📌'
);

const oldSpecial={
  representativeTier:1,
  representativeMediaPriority:100,
  strictActivity:'천타버스 추석특집',
  displaySummary:'천타버스 추석특집',
  activityDate:'2026-09-26',
  sourcePublishedAt:'2026-09-25 21:10:52',
  isCrewLeader:true
};
const newContest={
  ...hunterPost,
  representativeMediaPriority:0,
  sourcePublishedAt:'2026-09-30 01:45:38'
};
assert.ok(
  batch.compareRepresentativeCandidates(newContest,oldSpecial) < 0,
  'new different activity must outrank stale media-priority event'
);

const sameActivityOlder={
  ...newContest,
  sourcePublishedAt:'2026-09-29 01:00:00',
  representativeMediaPriority:5
};
const sameActivityNewer={
  ...newContest,
  sourcePublishedAt:'2026-09-30 01:45:38',
  representativeMediaPriority:0
};
assert.ok(
  batch.compareRepresentativeCandidates(sameActivityOlder,sameActivityNewer) < 0,
  'media priority may still break ties within the same activity'
);


const selectedMeeting={
  id:'meeting-main',
  strictCrew:'머리퍼리',
  strictActivity:'머리퍼리 회의',
  displaySummary:'머리퍼리 회의',
  activityDate:'2026-09-28',
  originalTitle:'머리퍼리 회의',
  contents:'머리퍼리 회의',
  boardName:'공지사항',
  imageUrl:'',
  sheetImageUrl:'',
  isCrewLeader:false,
  extractionComplete:true
};
const memberMeetingImage={
  ...selectedMeeting,
  id:'meeting-member',
  originalTitle:'9/28 머리퍼리 회의합니다',
  imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/meeting.png',
  sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url=x&fit=sheet',
  isCrewLeader:true
};
const wrongDayImage={
  ...memberMeetingImage,
  id:'meeting-wrong-day',
  activityDate:'2026-09-27'
};
const pickedPostImage=batch.choosePostImageCandidate(
  selectedMeeting,
  [selectedMeeting,wrongDayImage,memberMeetingImage]
);
assert.ok(pickedPostImage);
assert.strictEqual(pickedPostImage.imageSource,'post_member');
assert.strictEqual(pickedPostImage.imagePostId,'meeting-member');

const selectedSelfImage={
  ...selectedMeeting,
  id:'meeting-self',
  imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/self.png',
  sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url=self&fit=sheet'
};
assert.strictEqual(
  batch.choosePostImageCandidate(selectedSelfImage,[selectedSelfImage,memberMeetingImage]).imageSource,
  'post_self'
);

assert.strictEqual(
  batch.vodMatchScore({
    ...selectedMeeting,
    strictCrew:'강씨세가',
    strictActivity:'강씨세가 1주년',
    displaySummary:'강씨세가 1주년',
    activityDate:'2026-09-17'
  },{
    id:'207422027',
    title:'강씨세가 1주년 근황토크',
    publishedAt:'2026-09-17 20:00:00'
  }),
  -1,
  'user-verified visually poor VOD thumbnail must be skipped'
);

const preferredVodScore=batch.vodMatchScore(selectedMeeting,{
  id:'208370567',
  title:'[이브닛]머리퍼리 회의와 후열겜',
  publishedAt:'2026-09-28 19:00:00'
});
const genericVodScore=batch.vodMatchScore(selectedMeeting,{
  id:'other',
  title:'머리퍼리 회의',
  publishedAt:'2026-09-28 19:00:00'
});
assert.ok(preferredVodScore>genericVodScore,'verified representative VOD should win a relevant tie');

const imageInternals=require('../api/image.js')._internals;
assert.deepStrictEqual(
  imageInternals.cropPlanForSheet(1000,2200),
  {crop:true,left:0,top:0,width:1000,height:1250}
);
assert.deepStrictEqual(
  imageInternals.cropPlanForSheet(1600,900),
  {crop:false,width:1600,height:900}
);

console.log('crew-news-automation v1.6 reliability tests passed');
