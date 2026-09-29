'use strict';

const SOOP_BOARD_HOSTS = [
  'https://chapi.sooplive.com',
  'https://chapi.sooplive.co.kr'
];
const SOOP_VOD_HOSTS = [
  'https://chapi.sooplive.com',
  'https://chapi.sooplive.co.kr'
];

const SOOP_MENU_HOSTS = [
  'https://api-channel.sooplive.com',
  'https://api-channel.sooplive.co.kr'
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
};

function safeStation(value = '') {
  const station = String(value || '').trim();
  return /^[A-Za-z0-9_-]{2,64}$/.test(station) ? station : '';
}

function intParam(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function safeText(value = '', max = 20000) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, max);
}

function textFromUnknown(value, depth = 0) {
  if (value == null || depth > 6) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => textFromUnknown(item, depth + 1)).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const preferred = ['plain_text','plainText','text','html','contents','content','body','memo','description','message','value','data'];
    for (const key of preferred) {
      if (!(key in value)) continue;
      const text = textFromUnknown(value[key], depth + 1);
      if (text && !/^\[object Object\]$/i.test(text.trim())) return text;
    }
    return Object.entries(value)
      .filter(([key]) => !/^(id|seq|no|url|link|image|img|thumb|profile|user|nick|date|time|count|like|comment|board|station)$/i.test(key))
      .map(([, item]) => textFromUnknown(item, depth + 1)).filter(Boolean).join(' ');
  }
  return '';
}

function cleanBody(value = '', max = 12000) {
  return safeText(textFromUnknown(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n'), max);
}

function summarizeGenericPostTitle(title = '', body = '') {
  const raw = safeText(title, 500).replace(/\s+/g, ' ').trim();
  const generic = !raw ||
    /^\d{6}\s*(?:오늘|공지|방송|일정)?\s*$/i.test(raw) ||
    /^오늘(?:의)?\s*(?:방송|공지|일정)?\s*$/i.test(raw) ||
    /^오뱅(?:공|공지)?\s*$/i.test(raw) ||
    /^공지\s*$/i.test(raw);
  if (!generic) return raw;

  const text = safeText(body, 12000).replace(/\s+/g, ' ').trim();
  const activity = '(정기\\s*회의|비방\\s*회의|회의|중계\\s*합방|종겜\\s*합방|합방|메이드\\s*카페|모캡\\s*합방|모집|면접|합격|영입|가입|탈퇴|입주|행사|대회|회식|여행|모임|콘텐츠|컨텐츠)';
  const explicit = text.match(new RegExp('([가-힣A-Za-z0-9_]{2,24})\\s*' + activity, 'i'));
  if (explicit) return (explicit[1] + ' ' + explicit[2]).replace(/\s+/g, ' ').trim();
  return raw;
}

function first(row, keys) {
  for (const key of keys) {
    const value = row && row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function absoluteHttps(raw = '') {
  const value = String(raw || '').trim().replace(/&amp;/g, '&');
  if (!value) return '';
  try {
    const url = new URL(value.startsWith('//') ? 'https:' + value : value);
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

const POST_IMAGE_HOSTS = new Set([
  'stimg.sooplive.com','stimg.sooplive.co.kr','stimg.afreecatv.com',
  'res.sooplive.com','res.sooplive.co.kr',
  'liveimg.sooplive.com','liveimg.sooplive.co.kr',
  'vodimg.sooplive.com','vodimg.sooplive.co.kr'
]);

function looksLikeContentImage(url = '') {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!POST_IMAGE_HOSTS.has(host)) return false;
    if (/(?:profile|avatar|favicon|logo|thumb_profile|channel_logo|bj_logo)/i.test(parsed.pathname)) return false;
    return /(?:NORMAL_BBS|bbs|board|upload|image|img|attach|file|post)/i.test(parsed.pathname) ||
      /\.(?:png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(parsed.pathname + parsed.search);
  } catch (_) {
    return false;
  }
}

function collectImageUrls(value, out = [], depth = 0, keyHint = '') {
  if (depth > 6 || out.length >= 24 || value == null) return out;
  if (typeof value === 'string') {
    const strings = [];
    if (/https?:\/\//i.test(value) || /\/\//.test(value)) {
      for (const match of value.matchAll(/(?:https?:)?\/\/[^\s"'<>\\]+/gi)) strings.push(match[0]);
      for (const match of value.matchAll(/(?:src|data-src|href)\s*=\s*["']([^"']+)["']/gi)) strings.push(match[1]);
    }
    if (/image|img|thumb|file|attach|photo|picture/i.test(keyHint)) strings.unshift(value);
    for (const candidate of strings) {
      const url = absoluteHttps(candidate);
      if (!url || !looksLikeContentImage(url) || out.includes(url)) continue;
      out.push(url);
      if (out.length >= 24) break;
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, out, depth + 1, keyHint);
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectImageUrls(item, out, depth + 1, key);
  }
  return out;
}

function normalizeBoardName(row = {}, menuByNo = new Map()) {
  const bbsNo = String(first(row, ['bbs_no', 'bbsNo', 'board_no', 'boardNo']) || '');
  return safeText(
    first(row, ['bbs_name', 'board_name', 'boardName', 'menu_name', 'menuName']) ||
    menuByNo.get(bbsNo) ||
    '',
    120
  );
}

function classifyAccess(boardName = '', row = {}) {
  const label = (boardName + ' ' + safeText(first(row, ['scope_name', 'scope', 'auth_name', 'permission_name']), 120)).trim();
  if (/구독/i.test(label)) return 'subscriber';
  if (/애청자|팬\s*게시판|favorite/i.test(label)) return 'favorite';
  if (/비공개|private/i.test(label)) return 'restricted';
  return 'public';
}

async function fetchJson(url, headers = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { ...BROWSER_HEADERS, ...headers }
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!response.ok || data == null) {
      const error = new Error('upstream_' + response.status);
      error.status = response.status;
      error.body = text.slice(0, 500);
      throw error;
    }
    return { data, status: response.status, url: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function firstJson(urls, headers) {
  const errors = [];
  for (const url of urls) {
    try {
      return await fetchJson(url, headers);
    } catch (error) {
      errors.push({ url, error: String(error && error.message || error), status: Number(error && error.status || 0) || null });
    }
  }
  const failure = new Error('soop_upstream_unavailable');
  failure.errors = errors;
  throw failure;
}

async function fetchMenu(station, headers) {
  const urls = SOOP_MENU_HOSTS.map(host => `${host}/v1.1/channel/${encodeURIComponent(station)}/menu`);
  try {
    const result = await firstJson(urls, headers);
    const rows = Array.isArray(result.data && result.data.board) ? result.data.board : [];
    const byNo = new Map();
    for (const row of rows) {
      const no = String(first(row, ['bbsNo', 'bbs_no', 'boardNo', 'board_no']) || '');
      const name = safeText(first(row, ['name', 'title', 'boardName', 'board_name']), 120);
      if (no && name) byNo.set(no, name);
    }
    return { rows, byNo, source: result.url };
  } catch (error) {
    return { rows: [], byNo: new Map(), source: '', error: String(error && error.message || error) };
  }
}

function normalizeVod(row, station, req) {
  const id = String(first(row, ['title_no','titleNo','no']) || '').replace(/\D/g, '');
  const title = safeText(first(row, ['title_name','title','subject']), 500);
  const publishedAt = safeText(first(row, ['reg_date','regDate','created_at','createdAt']), 80);
  const candidates = collectImageUrls(row, []);
  const rawThumb = absoluteHttps(first(row, ['thumb','thumbnail','thumb_url','thumbnail_url','image','image_url','title_img','vod_thumb']) || '');
  const imageUrl = rawThumb || candidates[0] || '';
  return {
    id,
    title,
    publishedAt,
    vodUrl: id ? `https://vod.sooplive.com/player/${id}` : '',
    imageUrl,
    sheetImageUrl: proxyImageUrl(req, imageUrl),
    station
  };
}

async function fetchVods(station, req, {type='review', page=1, perPage=12}={}) {
  const safeType = /^(?:all|review|normal)$/.test(type) ? type : 'review';
  const params = new URLSearchParams({page:String(page),per_page:String(perPage),orderby:'reg_date'});
  const urls = SOOP_VOD_HOSTS.map(host => `${host}/api/${encodeURIComponent(station)}/vods/${safeType}?${params}`);
  const result = await firstJson(urls, {Referer:`https://www.sooplive.com/station/${station}/vod/${safeType}`});
  const rows = Array.isArray(result.data && result.data.data) ? result.data.data : [];
  return rows.map(row => normalizeVod(row, station, req));
}

function proxyImageUrl(req, url) {
  if (!url) return '';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'crew-news-automation.vercel.app').split(',')[0].trim();
  return `${proto}://${host}/api/image?url=${encodeURIComponent(url)}`;
}

function normalizePost(row, station, menuByNo, req) {
  const id = String(first(row, ['title_no', 'titleNo', 'post_no', 'postNo', 'article_no', 'articleNo', 'no']) || '').replace(/\D/g, '');
  const boardName = normalizeBoardName(row, menuByNo);
  const images = collectImageUrls(row);
  const imageUrl = images[0] || '';
  const contents = cleanBody(first(row, ['contents', 'content', 'body']), 12000);
  const rawTitle = safeText(first(row, ['title_name', 'title', 'subject']), 500);
  return {
    id,
    title: summarizeGenericPostTitle(rawTitle, contents),
    originalTitle: rawTitle,
    author: safeText(first(row, ['user_nick', 'userNick', 'writer_nick', 'writerNick', 'nickname']), 160),
    authorId: safeText(first(row, ['user_id', 'userId', 'writer_id', 'writerId']), 120),
    publishedAt: safeText(first(row, ['reg_date', 'regDate', 'created_at', 'createdAt', 'write_date']), 80),
    bbsNo: String(first(row, ['bbs_no', 'bbsNo', 'board_no', 'boardNo']) || ''),
    boardName,
    accessType: classifyAccess(boardName, row),
    postUrl: id ? `https://www.sooplive.com/station/${station}/post/${id}` : '',
    imageUrl,
    sheetImageUrl: proxyImageUrl(req, imageUrl),
    hashtags: first(row, ['hashtags', 'hash_tags', 'tags']) || [],
    contents
  };
}

const LAST_GOOD_TTL_MS=6*60*60*1000;
const lastGood=new Map();
function snapshotKey({station,page,perPage,keyword,startDate,endDate}){return [station,page,perPage,keyword,startDate,endDate].join('|')}
function rememberLastGood(key,payload){lastGood.set(key,{at:Date.now(),payload});if(lastGood.size>80){const oldest=[...lastGood.entries()].sort((a,b)=>a[1].at-b[1].at)[0]?.[0];if(oldest)lastGood.delete(oldest)}}
function readLastGood(key){const row=lastGood.get(key);if(!row||Date.now()-row.at>LAST_GOOD_TTL_MS){if(row)lastGood.delete(key);return null}return row}

function setPublicCache(res,{browser=60,cdn=600,stale=3600}={}){
  res.setHeader('Cache-Control',`public, max-age=${browser}, stale-while-revalidate=${stale}`);
  res.setHeader('CDN-Cache-Control',`public, max-age=${cdn}, stale-while-revalidate=${stale}`);
  res.setHeader('Vercel-CDN-Cache-Control',`public, max-age=${cdn}, stale-while-revalidate=${stale}`);
}
function setNoStore(res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('CDN-Cache-Control','no-store');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const requestUrl = new URL(req.url || '/', 'https://chunbong.local');
  const forceRefresh = requestUrl.searchParams.get('refresh') === '1';
  const mode = requestUrl.searchParams.get('mode') || 'posts';
  const station = safeStation(requestUrl.searchParams.get('station') || '');
  if (!station) return res.status(400).json({ error: 'invalid_station' });

  if (mode === 'vods') {
    const vodType = safeText(requestUrl.searchParams.get('vod_type') || 'review', 16);
    const vodPage = intParam(requestUrl.searchParams.get('page'), 1, 1, 20);
    const vodPerPage = intParam(requestUrl.searchParams.get('per_page'), 12, 1, 30);
    try {
      const vods = await fetchVods(station, req, {type:vodType,page:vodPage,perPage:vodPerPage});
      setPublicCache(res,{browser:300,cdn:3600,stale:21600});
      return res.status(200).json({ok:true,station,mode:'vods',count:vods.length,vods});
    } catch (error) {
      setNoStore(res);
      return res.status(502).json({ok:false,error:'soop_vod_unavailable',station});
    }
  }

  const page = intParam(requestUrl.searchParams.get('page'), 1, 1, 100);
  const perPage = intParam(requestUrl.searchParams.get('per_page'), 50, 1, 50);
  const keyword = safeText(requestUrl.searchParams.get('keyword') || '', 120);
  const startDate = safeText(requestUrl.searchParams.get('start_date') || '', 32);
  const endDate = safeText(requestUrl.searchParams.get('end_date') || '', 32);
  const cacheKey=snapshotKey({station,page,perPage,keyword,startDate,endDate});

  const cookie = safeText(process.env.SOOP_CREW_COOKIE || process.env.SOOP_COOKIE || '', 12000);
  const headers = {
    Referer: `https://www.sooplive.com/station/${station}/post`,
    Origin: 'https://www.sooplive.com',
    ...(cookie ? { Cookie: cookie } : {})
  };

  const menu = await fetchMenu(station, headers);
  const params = new URLSearchParams({
    per_page: String(perPage),
    start_date: startDate,
    end_date: endDate,
    field: 'title,contents,user_nick,user_id,hashtags',
    keyword,
    type: 'all',
    order_by: 'reg_date',
    board_number: '',
    page: String(page)
  });

  const urls = SOOP_BOARD_HOSTS.map(host => `${host}/api/${encodeURIComponent(station)}/board/?${params.toString()}`);
  try {
    const result = await firstJson(urls, headers);
    const rows = Array.isArray(result.data && result.data.data) ? result.data.data : [];
    const posts = rows.map(row => normalizePost(row, station, menu.byNo, req));
    const debug = requestUrl.searchParams.get('debug') === '1';
    if(cookie || forceRefresh)setNoStore(res);
    else setPublicCache(res,{browser:60,cdn:600,stale:3600});
    const payload={
      ok: true,
      station,
      authenticated: Boolean(cookie),
      boardSource: result.url,
      menuSource: menu.source || '',
      menuError: menu.error || '',
      page,
      perPage,
      count: posts.length,
      posts,
      ...(debug ? {
        diagnostics: rows.slice(0, 12).map((row, index) => ({
          index,
          keys: Object.keys(row || {}).slice(0, 80),
          imageUrls: collectImageUrls(row, []).slice(0, 12),
          contentType: typeof first(row, ['contents','content','body']),
          contentKeys: first(row, ['contents','content','body']) && typeof first(row, ['contents','content','body']) === 'object'
            ? Object.keys(first(row, ['contents','content','body'])).slice(0, 50)
            : []
        }))
      } : {})
    };
    if(!cookie&&!forceRefresh&&!debug)rememberLastGood(cacheKey,payload);
    return res.status(200).json(payload);
  } catch (error) {
    const snapshot=!cookie&&!forceRefresh?readLastGood(cacheKey):null;
    if(snapshot){
      setPublicCache(res,{browser:60,cdn:300,stale:21600});
      return res.status(200).json({...snapshot.payload,stale:true,snapshotAt:new Date(snapshot.at).toISOString()});
    }
    setNoStore(res);
    return res.status(502).json({
      ok: false,
      error: 'soop_board_unavailable',
      station,
      authenticated: Boolean(cookie),
      attempts: Array.isArray(error && error.errors) ? error.errors : []
    });
  }
};

module.exports._internals = {
  safeStation,
  absoluteHttps,
  looksLikeContentImage,
  collectImageUrls,
  classifyAccess,
  normalizePost,
  summarizeGenericPostTitle,
  normalizeVod,
  fetchVods
};
