
'use strict';

const assert=require('assert');
const batch=require('../api/crew-news-batch.js');

const payload={
  ok:true,
  strictCrew:'자라섬',
  preservePrevious:false,
  selected:{
    id:'209518583',
    station:'seh0305',
    summary:'크루 합방',
    displaySummary:'크루 합방',
    activityDate:'2026-10-11'
  }
};
const url=new URL('https://crew-news.local/api/crew-news-batch?stations=dstv,seh0305,qwhy1040,darae0722,ayo1gg,star124,dotcha,ioocom');

assert.deepStrictEqual(
  batch._internals.consensusStationOrder(payload,url),
  ['seh0305','dstv','qwhy1040','darae0722'],
  'VOD consensus must cap itself at four stations and prioritize selected author + leader'
);

assert.equal(
  batch._internals.shouldAttemptVodConsensus(payload,new Date('2026-10-12T03:00:00Z')),
  true,
  'recent generic crew collaboration should trigger VOD consensus'
);
assert.equal(
  batch._internals.shouldAttemptVodConsensus({
    ...payload,
    selected:{...payload.selected,summary:'PEAK 합방',displaySummary:'PEAK 합방'}
  },new Date('2026-10-12T03:00:00Z')),
  false,
  'already specific activities must not incur extra VOD requests'
);
assert.equal(
  batch._internals.shouldAttemptVodConsensus({
    ...payload,
    selected:{...payload.selected,activityDate:'2026-10-01'}
  },new Date('2026-10-12T03:00:00Z')),
  false,
  'old generic events must not be rescanned forever'
);

console.log('vod-consensus-cost-policy tests passed');
