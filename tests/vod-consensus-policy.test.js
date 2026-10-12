
'use strict';

const assert=require('assert');
const policy=require('../lib/vod-consensus-policy.js');

const activityDate='2026-10-11';
const byStation=new Map([
  ['seh0305',[
    {id:'209566579',station:'seh0305',title:'[자라섬[ 피파 내전합니돵 3:3 오랜만에 레츠꼬우',publishedAt:'2026-10-12 00:37:02',vodUrl:'https://vod.sooplive.com/player/209566579'}
  ]],
  ['dstv',[
    {id:'209566229',station:'dstv',title:'홀푸어 [자라섬] 빅윈 피파4',publishedAt:'2026-10-12 00:34:06',vodUrl:'https://vod.sooplive.com/player/209566229'}
  ]],
  ['qwhy1040',[
    {id:'209578907',station:'qwhy1040',title:'[자라섬] 피파 3:3 내전 / 후열 증바람!',publishedAt:'2026-10-12 03:08:37',vodUrl:'https://vod.sooplive.com/player/209578907'}
  ]],
  ['ioocom',[
    {id:'209573951',station:'ioocom',title:'자라섬 피파 내전,노룰 퍼스트골',publishedAt:'2026-10-12 01:59:16',vodUrl:'https://vod.sooplive.com/player/209573951'}
  ]]
]);

assert.equal(policy.isGenericForVodConsensus('크루 합방'),true);
assert.equal(policy.isGenericForVodConsensus('합방'),true);
assert.equal(policy.isGenericForVodConsensus('PEAK 합방'),false);
assert.equal(policy.isGenericForVodConsensus('SBO 합격 축하'),false);

assert.deepStrictEqual(
  policy.extractVodActivities('[자라섬] 피파 3:3 내전 / 후열 증바람!','자라섬')[0],
  {label:'피파 3:3 내전',signature:'football:3:3:내전',specificity:100}
);
assert.deepStrictEqual(
  policy.extractVodActivities('자라섬 피파 내전,노룰 퍼스트골','자라섬')[0],
  {label:'피파 내전',signature:'football:any:내전',specificity:80}
);

const consensus=policy.findVodConsensus({
  crew:'자라섬',
  activityDate,
  vodsByStation:byStation
});
assert.ok(consensus,'multiple member VODs should yield a consensus');
assert.equal(consensus.label,'피파 3:3 내전');
assert.equal(consensus.signature,'football:3:3:내전');
assert.equal(consensus.supportCount,2);
assert.deepStrictEqual(new Set(consensus.supportStations),new Set(['seh0305','qwhy1040']));

const picked=policy.pickRepresentativeVod(consensus,{preferredStation:'seh0305'});
assert.equal(picked.station,'seh0305','selected-post author VOD should win among equally s...[truncated]