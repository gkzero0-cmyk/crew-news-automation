'use strict';

const assert = require('assert');
const batch = require('../api/crew-news-batch.js');
const { compareRepresentativeCandidates } = batch._internals;

const olderLeader = {
  representativeTier: 1,
  isCrewLeader: true,
  strictActivity: '러닝',
  activityDate: '2026-09-18',
  sourcePublishedAt: '2026-09-18 11:47:21'
};

const newerMember = {
  representativeTier: 2,
  isCrewLeader: false,
  strictActivity: '점호',
  activityDate: '2026-09-28',
  sourcePublishedAt: '2026-09-28 12:41:35'
};

assert(
  compareRepresentativeCandidates(newerMember, olderLeader) < 0,
  'newer member activity must outrank an older leader activity'
);
assert(
  compareRepresentativeCandidates(olderLeader, newerMember) > 0,
  'older leader activity must not pin above a newer member activity'
);

const sameEventMember = {
  representativeTier: 2,
  representativeMediaPriority: 0,
  isCrewLeader: false,
  strictActivity: '점호',
  activityDate: '2026-09-28',
  sourcePublishedAt: '2026-09-28 12:50:00'
};

const sameEventLeader = {
  representativeTier: 1,
  representativeMediaPriority: 0,
  isCrewLeader: true,
  strictActivity: '점호',
  activityDate: '2026-09-28',
  sourcePublishedAt: '2026-09-28 12:40:00'
};

assert(
  compareRepresentativeCandidates(sameEventLeader, sameEventMember) < 0,
  'leader representative should remain preferred inside the same activity/date'
);

console.log('representative-selection regression: ok');
