'use strict';

const assert=require('assert');
const policy=require('../lib/editorial-vod-policy.js');

const now=new Date('2026-10-06T00:00:00+09:00');

{
  const selected={summary:'나들이',activityDate:'2026-10-05',imageUrl:''};
  const vods=[
    {id:'208879223',title:'장지수용소 나들이 [무수]',publishedAt:'2026-10-04 17:56:59'},
    {id:'x',title:'무수 합방',publishedAt:'2026-10-05 20:00:00'}
  ];
  assert.equal(policy.chooseVodCandidate(selected,vods,now).id,'208879223');
}

{
  const selected={summary:'뇌피셜 게임',activityDate:'2026-10-15',imageUrl:''};
  const vods=[{id:'future',title:'뇌피셜 게임',publishedAt:'2026-10-15 20:00:00'}];
  assert.equal(policy.chooseVodCandidate(selected,vods,now),null);
}

{
  const selected={summary:'합방',activityDate:'2026-10-05',imageUrl:''};
  const vods=[{id:'generic',title:'합방',publishedAt:'2026-10-05 20:00:00'}];
  assert.equal(policy.chooseVodCandidate(selected,vods,now),null);
}

console.log('editorial-vod-policy regression tests passed');
