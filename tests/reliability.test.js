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

console.log('crew-news-automation v1.3 reliability tests passed');
