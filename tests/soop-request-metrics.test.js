'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crewNews = require('../internal/crew-news.js');

const internals = crewNews._internals || {};
assert.equal(typeof internals.createSoopRequestMetrics, 'function', 'request metrics factory should exist');
assert.equal(typeof internals.snapshotSoopRequestMetrics, 'function', 'request metrics snapshot should exist');

const metrics = internals.createSoopRequestMetrics();
assert.deepEqual(internals.snapshotSoopRequestMetrics(metrics), {
  totalRequests: 0,
  boardRequests: 0,
  menuRequests: 0,
  menuCacheHits: 0,
  menuCacheMisses: 0,
  vodListRequests: 0,
  postVerifyRequests: 0,
  postVerifyCacheHits: 0,
  vodDetailRequests: 0
});

const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
assert.match(code, /SCRIPT_VERSION:\s*'crew-apps-script-v1\.7\.5'/);
for (const label of [
  'SOOPTotalRequests',
  'SOOPBoardRequests',
  'SOOPMenuRequests',
  'SOOPMenuCacheHits',
  'SOOPMenuCacheMisses',
  'SOOPVodListRequests',
  'SOOPPostVerifyRequests',
  'SOOPPostVerifyCacheHits',
  'SOOPVodDetailRequests'
]) {
  assert.ok(code.includes(label), `Code.gs should expose ${label}`);
}

const batchCode = fs.readFileSync(path.join(__dirname, '..', 'internal', 'crew-news-batch-core.js'), 'utf8');
assert.ok(batchCode.includes('soopMetrics'), 'batch response should expose soopMetrics');
const allCode = fs.readFileSync(path.join(__dirname, '..', 'api', 'crew-news-all.js'), 'utf8');
assert.ok(allCode.includes('soopMetrics'), 'single-batch envelope should expose aggregated soopMetrics');

(async () => {
  const originalFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async () => {
    upstreamCalls += 1;
    return {
      ok: true,
      status: 200,
      url: 'https://api-channel.sooplive.com/v1.1/channel/metricstation/menu',
      async text() {
        return JSON.stringify({ board: [{ bbsNo: '1', name: '공지사항' }] });
      }
    };
  };

  try {
    internals.clearMenuCacheForTest();
    const liveMetrics = internals.createSoopRequestMetrics();
    await internals.fetchMenu('metricstation', {}, liveMetrics);
    await internals.fetchMenu('metricstation', {}, liveMetrics);
    const snapshot = internals.snapshotSoopRequestMetrics(liveMetrics);
    assert.equal(upstreamCalls, 1, 'second menu lookup should be served from cache');
    assert.equal(snapshot.totalRequests, 1);
    assert.equal(snapshot.menuRequests, 1);
    assert.equal(snapshot.menuCacheMisses, 1);
    assert.equal(snapshot.menuCacheHits, 1);
  } finally {
    global.fetch = originalFetch;
    internals.clearMenuCacheForTest();
  }

  console.log('SOOP request metrics regression: ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
