'use strict';

const assert = require('assert');
const core = require('../internal/crew-news-batch-core.js')._internals;

const {
  parseActivityDurationDays,
  applyContinuousEventContext,
  sameRepresentativeActivity,
  compareRepresentativeCandidates,
  choosePostImageCandidate,
  vodMatchScore,
  strictCrewPost
} = core;

assert.equal(parseActivityDurationDays('진드기 일본 여행 4박 5일'), 5, '4박5일 must create a five-day event window');
assert.equal(parseActivityDurationDays('크루 여행 3박4일'), 4, '3박4일 must create a four-day event window');
assert.equal(parseActivityDurationDays('10월 4일 여행'), 0, 'ordinary dates must not be mistaken for durations');

const bodyOnlyTravelAnnouncement = strictCrewPost({
  id: '208395133',
  title: '9/29 오뱅내',
  originalTitle: '9/29 오뱅내',
  author: '히키☆',
  authorId: 'hikicomoring',
  publishedAt: '2026-09-29 12:54:08',
  boardName: '⏰방송알림',
  accessType: 'public',
  contents: '내일부터 진드기 일본여행으로 3박 4일동안 빙하기에 들어가기 때문에 오늘은 이끼단들과 놀려고 합니다'
}, '진드기', 'hikicomoring');
assert(bodyOnlyTravelAnnouncement, 'official broadcast-alert post with explicit crew travel duration should qualify even when the generic title has no crew name');
assert.equal(bodyOnlyTravelAnnouncement.activityDate, '2026-09-30');
assert.equal(bodyOnlyTravelAnnouncement.activityDurationDays, 4);

const retrospectiveBroadcastAlert = strictCrewPost({
  id: 'after-trip-hiki',
  title: '10/4 오뱅내',
  originalTitle: '10/4 오뱅내',
  author: '히키☆',
  authorId: 'hikicomoring',
  publishedAt: '2026-10-04 10:38:21',
  boardName: '⏰방송알림',
  accessType: 'public',
  contents: '오늘은 11시에 뱅온해서 1시에 진드기 단체 일본여행 후기를 다같이 얘기해볼 계획입니다. 일본에서 어떤 일이 있었는지 재밌게 얘기하고 싶어요.'
}, '진드기', 'hikicomoring');
assert.equal(retrospectiveBroadcastAlert, null, 'post-trip travel review must not become a new crew travel event');

const retrospectiveNotice = strictCrewPost({
  id: 'after-trip-yaguja',
  title: '오늘 할거 많다 집중~~!!!',
  originalTitle: '오늘 할거 많다 집중~~!!!',
  author: '야구자',
  authorId: 'yaguja00',
  publishedAt: '2026-10-04 11:38:56',
  boardName: '공지',
  accessType: 'public',
  contents: '진드기 여행 1시에 진드기 단체 여행 후기 이후에 개인적으로 사진 보면서 개인 후기풀기'
}, '진드기', 'yaguja00');
assert.equal(retrospectiveNotice, null, 'notice-board travel retrospective must not replace the original travel news');

const candidates = [
  {
    id:'start', strictCrew:'진드기', strictActivity:'여행', displaySummary:'진드기 여행',
    activityDate:'2026-09-30', activityDurationDays:5,
    sourcePublishedAt:'2026-09-29 21:00:00', publishedAt:'2026-09-29 21:00:00',
    title:'내일부터 진드기 일본 여행 4박 5일', contents:'진드기 여행',
    imageUrl:'', representativeTier:1, isCrewLeader:true
  },
  {
    id:'during', strictCrew:'진드기', strictActivity:'여행', displaySummary:'진드기 여행',
    activityDate:'2026-10-03', activityDurationDays:0,
    sourcePublishedAt:'2026-10-03 12:00:00', publishedAt:'2026-10-03 12:00:00',
    title:'진드기 일본 여행 4일차', contents:'진드기 여행 중',
    imageUrl:'https://example.com/crew-trip.jpg', sheetImageUrl:'https://example.com/crew-trip.jpg',
    representativeTier:2, isCrewLeader:false, extractionComplete:true
  }
];

const normalized = applyContinuousEventContext(candidates);
assert.equal(normalized[0].activityDate, '2026-09-30', 'travel event must keep its start date');
assert.equal(normalized[1].activityDate, '2026-09-30', 'later posts inside the trip must inherit the event start date');
assert.equal(normalized[1].continuousEventEndDate, '2026-10-04', '4박5일 window must end on 10/4');
assert.equal(sameRepresentativeActivity(normalized[0], normalized[1]), true, 'posts inside one trip window must be one representative activity');

const laterSameTier = {...normalized[1], representativeTier:1, isCrewLeader:true};
assert(
  compareRepresentativeCandidates(normalized[0], laterSameTier) < 0,
  'same-tier follow-up posts inside one continuous event must not replace the start representative only because they are newer'
);

const image = choosePostImageCandidate(normalized[0], normalized);
assert(image, 'a suitable same-event post image should be found across the trip window');
assert.equal(image.imageUrl, 'https://example.com/crew-trip.jpg');
assert.equal(image.imageSource, 'post_member');

const travelPost = {
  strictCrew:'진드기', strictActivity:'여행', displaySummary:'진드기 여행',
  activityDate:'2026-09-30', title:'진드기 여행', contents:'4박5일 일본 여행'
};
const genericTravelVod = {
  id:'generic-vod', title:'진드기 일본 여행', publishedAt:'2026-10-01 12:00:00',
  imageUrl:'https://example.com/personal-stream-thumb.jpg'
};
assert.equal(
  vodMatchScore(travelPost, genericTravelVod),
  -1,
  'unverified travel VOD thumbnails must not become representative crew-event images from title match alone'
);
assert(
  vodMatchScore(travelPost, {...genericTravelVod, verifiedEventMedia:true}) >= 0,
  'explicitly verified travel-event VOD media may still be used'
);

// Exact ZZAM지트 PEAK source and recorded VOD describe the same 4-person event.
const peakPost={id:'209239633',strictCrew:'ZZAM지트',strictActivity:'합방',activityDate:'2026-10-08',contents:'오늘 저녁 8시 ZZAM지트에서 PEAK 합방. 숙봉 루센 냐냐 에이레네',displaySummary:'ZZAM지트 합방'};
const peakVod={id:'209278713',title:'[ZZAM지트]PEAK 진엔딩팟! W.루센, 냐냐, 에이레네',publishedAt:'2026-10-09 01:38:17',imageUrl:'',vodUrl:'https://vod.sooplive.com/player/209278713'};
assert(vodMatchScore(peakPost,peakVod)>=24,'confirmed overnight event must be eligible for VOD detail thumbnail retrieval');
assert.equal(vodMatchScore({...peakPost,contents:'ZZAM지트 PEAK 합방'},peakVod),-1,'missing corroborated participants must prevent forced image matching');
assert.equal(vodMatchScore(peakPost,{...peakVod,id:'some-other-video'}),-1,'unknown video must not inherit the verified event image exception');
assert(vodMatchScore({...peakPost,strictCrew:'다른크루'},peakVod)<24,'other crews must not inherit the high-confidence ZZAM media exception');

// Image matching regression: same crew and date must not mix independently
// named programs (nor treat personal photos as a crew poster).
{
  const selected={id:'c1',strictCrew:'ZZAM지트',strictActivity:'합방',
    displaySummary:'ZZAM지트 합방',activityDate:'2026-10-15',
    originalTitle:'오늘 방송 공지',contents:'8시에 ZZAM지트 PEAK 합방입니다'};
  const wrong={id:'c2',strictCrew:'ZZAM지트',strictActivity:'합방',
    displaySummary:'ZZAM지트 합방',activityDate:'2026-10-15',
    originalTitle:'Trash Day 합방 공지',contents:'8시에 ZZAM지트 Trash Day 합방입니다',
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/1/wrong.png'};
  assert.equal(choosePostImageCandidate(selected,[selected,wrong]),null,
    'a different named game must not supply a same-day thumbnail');
  const good={...wrong,id:'c3',originalTitle:'PEAK 합방 공지',contents:'ZZAM지트 PEAK 합방',
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/1/peak.png'};
  assert.equal(choosePostImageCandidate(selected,[selected,wrong,good]).imagePostId,'c3',
    'specific same-event post supplies a previously missing image');
  const portrait={...good,id:'c4',originalTitle:'오늘 개인 사진',contents:'셀카 올려요. ZZAM지트 PEAK 합방도 기대!',
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/1/selfie.png'};
  assert.equal(choosePostImageCandidate(selected,[selected,portrait]),null,
    'an unrelated selfie with a crew event mentioned cannot become its poster');
  const sourcePoster={...portrait,id:'c5',
    originalTitle:'ZZAM지트 PEAK 합방 공식 포스터',contents:'합방 공식 포스터',
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/1/official.png'};
  assert.equal(choosePostImageCandidate(selected,[selected,sourcePoster]).imagePostId,'c5',
    'credible official poster remains eligible');
  const generic={id:'g1',strictCrew:'천타버스',strictActivity:'합방',
    displaySummary:'천타버스 합방',activityDate:'2026-10-15',
    contents:'오늘 천타버스 합방이 있습니다'};
  const genericOther={...generic,id:'g2',contents:'오늘 천타버스 다른 합방',
    imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/1/other.png'};
  assert.equal(choosePostImageCandidate(generic,[generic,genericOther]),null,
    'unidentified same-day generic collabs must not share a thumbnail');
  const genericLinked={...genericOther,contents:'오늘 천타버스 합방 https://www.sooplive.com/station/test/post/123456789'};
  const linkTarget={...generic,id:'123456789'};
  assert.equal(choosePostImageCandidate(linkTarget,[linkTarget,genericLinked]).imagePostId,'g2',
    'an explicit link to the exact source restores missing images safely');
  const vr={...generic,id:'vr1',displaySummary:'천타버스 VR 합방',contents:'천타버스 VR 합방'};
  const vrc={...genericOther,id:'vrc1',displaySummary:'천타버스 VRC 합방',
    contents:'천타버스 VRC 합방'};
  assert.equal(choosePostImageCandidate(vr,[vr,vrc]),null,'VR and VRC are not the same event');
}


// Same-day group VOD from a DIFFERENT event is not a valid image source.
// Distinct matching event titles remain eligible, including empty-slot recovery.
{
  const selected={id:'notice',strictCrew:'ZZAM지트',strictActivity:'합방',
    displaySummary:'ZZAM지트 합방',activityDate:'2026-10-15',
    title:'오늘의 방송 공지',contents:'ZZAM지트 Trash Day 합방 오후 8시'};
  const wrong={id:'wrong-vod',title:'[ZZAM지트] PEAK 합방 단체 게임',
    publishedAt:'2026-10-15 23:00:00',
    imageUrl:'https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=bad'};
  const right={...wrong,id:'right-vod',title:'[ZZAM지트] Trash Day 합방 단체 게임'};
  assert.equal(vodMatchScore(selected,wrong),-1,
    'the crew and date cannot override a contradictory named game');
  assert.ok(vodMatchScore(selected,right)>=10,
    'the named same-event VOD can be an image candidate');
  const generic={...selected,contents:'ZZAM지트 크루 합방 예정'};
  const unrelated={...wrong,title:'[ZZAM지트] 크루 합방 단체 게임'};
  assert.equal(vodMatchScore(generic,unrelated),-1,
    'generic same-day crew group VOD is not proof of the selected event');
  const mystery={...selected,strictCrew:'강씨세가',strictActivity:'미스테리',
    displaySummary:'강씨세가 미스테리',contents:'강씨세가 미스테리'};
  assert.equal(vodMatchScore(mystery,{...wrong,title:'강씨세가 VR 합방 단체 콘텐츠'}),-1,
    'same-day crew group hit cannot override another concrete activity');
  assert.ok(vodMatchScore(mystery,{...wrong,title:'강씨세가 미스테리 합방'})>=10,
    'matching concrete crew activity remains eligible');
}

console.log('continuous event media policy: ok');
