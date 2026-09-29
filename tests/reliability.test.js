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

console.log('crew-news-automation v1.4 reliability tests passed');
