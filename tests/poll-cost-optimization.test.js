'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
  const codeGs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.match(codeGs, /TRIGGER_MINUTES:\s*30\b/, 'Apps Script trigger should run every 30 minutes');
  assert.match(codeGs, /30분 자동갱신 설치/, 'Apps Script menu label should describe the 30-minute trigger');

  const crewNews = require('../internal/crew-news.js');
  const internals = crewNews._internals || {};
  assert.strictEqual(internals.MENU_CACHE_TTL_MS, 6 * 60 * 60 * 1000, 'menu cache TTL should be 6 hours');
  assert.strictEqual(typeof internals.fetchMenu, 'function', 'fetchMenu should be testable');
  assert.strictEqual(typeof internals.clearMenuCacheForTest, 'function', 'menu cache should be resettable in tests');

  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async function(url) {
    fetchCalls += 1;
    return {
      ok: true,
      status: 200,
      url: String(url),
      text: async () => JSON.stringify({
        board: [
          { bbsNo: '123', name: '공지사항' }
        ]
      })
    };
  };

  try {
    internals.clearMenuCacheForTest();
    const first = await internals.fetchMenu('cachetest', {});
    const second = await internals.fetchMenu('cachetest', {});

    assert.strictEqual(first.byNo.get('123'), '공지사항');
    assert.strictEqual(second.byNo.get('123'), '공지사항');
    assert.strictEqual(fetchCalls, 1, 'second menu lookup should be served from the six-hour cache');
  } finally {
    global.fetch = originalFetch;
    if (typeof internals.clearMenuCacheForTest === 'function') internals.clearMenuCacheForTest();
  }

  // Concurrent lookups of one station must share the same upstream request.
  global.fetch = async function(url) {
    fetchCalls += 1;
    await new Promise(resolve => setImmediate(resolve));
    return {
      ok:true, status:200, url:String(url),
      text:async () => JSON.stringify({board:[{bbsNo:'777',name:'공지'}]})
    };
  };
  try {
    internals.clearMenuCacheForTest();
    const before=fetchCalls;
    const rows=await Promise.all(Array.from({length:5},()=>internals.fetchMenu('concurrentstation',{})));
    assert.equal(fetchCalls-before,1,'five simultaneous menu lookups should share one SOOP request');
    assert.ok(rows.every(row=>row.byNo.get('777')==='공지'));
  } finally {
    global.fetch=originalFetch;
    internals.clearMenuCacheForTest();
  }

  console.log('poll-cost-optimization.test.js passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
