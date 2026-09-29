'use strict';

const batchHandler = require('./crew-news-batch.js');
const { POLICY_VERSION } = require('../lib/version.js');

function clampInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function safeCrewRequests(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];

  for (const item of raw.slice(0, 12)) {
    const crew = String(item && item.crew || '').trim().slice(0, 40);
    const inputStations = Array.isArray(item && item.stations) ? item.stations : [];
    const stations = [...new Set(inputStations.map(value => String(value || '').trim())
      .filter(value => /^[A-Za-z0-9_-]{2,64}$/.test(value)))].slice(0, 20);
    const previousFingerprint = String(item && item.previousFingerprint || '')
      .trim().slice(0, 128);

    if (!crew || !stations.length || seen.has(crew)) continue;
    seen.add(crew);
    out.push({ crew, stations, previousFingerprint });
  }

  return out;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length || 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function invokeBatch(req, item, perPage) {
  let statusCode = 200;
  let body = null;
  const responseHeaders = {};

  const params = new URLSearchParams({
    stations: item.stations.join(','),
    per_page: String(perPage),
    client_policy: 'crew-automation-v1'
  });
  if (item.previousFingerprint) {
    params.set('previous_fingerprint', item.previousFingerprint);
  }

  const fakeReq = {
    method: 'GET',
    url: '/api/crew-news-batch?' + params.toString(),
    headers: { ...(req && req.headers || {}) }
  };
  const fakeRes = {
    status(code) {
      statusCode = Number(code) || 500;
      return this;
    },
    setHeader(key, value) {
      responseHeaders[String(key)] = value;
    },
    json(payload) {
      body = payload;
      return payload;
    },
    end(payload) {
      if (payload && body == null) {
        try { body = JSON.parse(String(payload)); } catch (_) { body = payload; }
      }
      return payload;
    }
  };

  try {
    await batchHandler(fakeReq, fakeRes);
  } catch (error) {
    statusCode = 500;
    body = {
      ok: false,
      complete: false,
      preservePrevious: true,
      healthStatus: 'degraded',
      error: String(error && error.message || error || 'batch_failed'),
      policyVersion: POLICY_VERSION
    };
  }

  return {
    crew: item.crew,
    status: statusCode,
    payload: body || {
      ok: false,
      complete: false,
      preservePrevious: true,
      healthStatus: 'degraded',
      error: 'empty_batch_response',
      policyVersion: POLICY_VERSION
    }
  };
}

function parseBody(req) {
  if (!req) return {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = req.body == null ? '' : String(req.body);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Crew-News-Policy', POLICY_VERSION);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const crews = safeCrewRequests(body.crews);
  if (!crews.length) {
    return res.status(400).json({ error: 'invalid_crews' });
  }

  const perPage = clampInt(body.per_page, 30, 1, 50);
  const batches = await mapLimit(crews, 2, item => invokeBatch(req, item, perPage));

  return res.status(200).json({
    ok: batches.some(item => item && item.payload),
    complete: batches.every(item =>
      item &&
      item.status >= 200 &&
      item.status < 300 &&
      item.payload &&
      item.payload.complete === true
    ),
    policyVersion: POLICY_VERSION,
    fetchMode: 'single-batch-v1',
    requestedCrews: crews.length,
    batches
  });
};

module.exports._internals = {
  clampInt,
  safeCrewRequests,
  mapLimit,
  parseBody
};
