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

console.log('continuous event media policy: ok');
