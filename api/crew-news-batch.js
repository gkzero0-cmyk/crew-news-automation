'use strict';

const core = require('../internal/crew-news-batch-core.js');
const crewNewsHandler = require('../internal/crew-news.js');
const enrichment = require('../lib/event-enrichment.js');
const {POLICY_VERSION}=require('../lib/version.js');

const LEADER_BY_CREW = Object.freeze({
  '조적단':'yjkim5500',
  '강씨세가':'rkdakstlr911',
  '진드기':'jangjh5409',
  '천타버스':'243000',
  'ZZAM지트':'zzamta0310',
  '장지수용소':'iamquaddurup',
  '머리퍼리':'beemong',
  '자라섬':'dstv'
});

function safeStations(raw='') {
  return [...new Set(String(raw||'').split(',').map(v=>v.trim()).filter(v=>/^[A-Za-z0-9_-]{2,64}$/.test(v)))].slice(0,20);
}

function captureRes() {
  const state={statusCode:200,headers:{},body:null};
  return {
    state,
    setHeader(name,value){ state.headers[String(name).toLowerCase()]=value; },
    status(code){ state.statusCode=Number(code)||200; return this; },
    json(body){ state.body=body; return body; }
  };
}

async function invoke(handler, req, url) {
  const fakeReq={...req,method:'GET',url};
  const fakeRes=captureRes();
  await handler(fakeReq,fakeRes);
  return fakeRes.state;
}

function copyHeaders(res, headers={}) {
  for (const [name,value] of Object.entries(headers||{})) {
    try { res.setHeader(name,value); } catch (_) {}
  }
}

function isoDaysAgo(days) {
  const d=new Date(Date.now()-days*24*60*60*1000);
  return d.toISOString().slice(0,10);
}

function displayDate(iso='') {
  const m=String(iso).match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

function sameEvent(coreSelected,event) {
  if (!coreSelected || !event) return false;
  const coreDate=String(coreSelected.activityDate||'').slice(0,10);
  if (!coreDate || coreDate!==event.activityDate) return false;
  const coreText=String(coreSelected.displaySummary||coreSelected.summary||'');
  return enrichment.normalize(coreText).includes(enrichment.normalize(event.activity)) ||
    enrichment.normalize(event.displaySummary).includes(enrichment.normalize(coreSelected.summary||''));
}

async function collectRawPosts(req, stations, crew, forceRefresh) {
  const all=[];
  const targets=[...new Set([
    ...stations,
    ...(enrichment.AUXILIARY_VALIDATORS[crew]||[])
  ])];
  for (const station of targets) {
    const params=new URLSearchParams({station,per_page:'30',start_date:isoDaysAgo(14)});
    if (forceRefresh) params.set('refresh','1');
    try {
      const result=await invoke(crewNewsHandler,req,`/api/crew-news?${params}`);
      if (result.statusCode<200 || result.statusCode>=300 || !result.body || result.body.ok!==true) continue;
      for (const post of result.body.posts||[]) all.push({...post,station});
    } catch (_) {}
  }
  return all;
}

async function collectLeaderVods(req, leaderStation, activityDate) {
  if (!leaderStation || !activityDate) return [];
  try {
    const list=await invoke(crewNewsHandler,req,`/api/crew-news?station=${encodeURIComponent(leaderStation)}&mode=vods&per_page=20`);
    if (list.statusCode<200 || list.statusCode>=300 || !list.body || list.body.ok!==true) return [];
    const candidates=(list.body.vods||[])
      .filter(v=>String(v.publishedAt||'').slice(0,10)===activityDate)
      .slice(0,3);
    const detailed=[];
    for (const vod of candidates) {
      try {
        const detail=await invoke(crewNewsHandler,req,`/api/crew-news?station=${encodeURIComponent(leaderStation)}&mode=vod-detail&title_no=${encodeURIComponent(vod.id)}`);
        const d=detail.body&&detail.body.vod;
        detailed.push({...vod,...(d||{}),station:leaderStation,vodUrl:vod.vodUrl||`https://vod.sooplive.com/player/${vod.id}`});
      } catch (_) {
        detailed.push({...vod,station:leaderStation});
      }
    }
    return detailed;
  } catch (_) {
    return [];
  }
}

function toCoreFingerprintInput(crew,event) {
  return {
    id:event.id,
    strictCrew:crew,
    strictActivity:event.activity,
    displaySummary:event.displaySummary,
    activityDate:event.activityDate,
    publishedAt:event.publishedAt,
    sourcePublishedAt:event.sourcePublishedAt,
    imageUrl:event.imageUrl||'',
    imageSource:event.imageSource||'none'
  };
}

function buildSelected(crew,event,fingerprint) {
  const date=displayDate(event.activityDate);
  return {
    id:event.id,
    station:event.station,
    postUrl:event.postUrl,
    summary:event.activity,
    displaySummary:event.displaySummary,
    extractionQuality:event.extractionQuality ?? 8,
    extractionComplete:event.extractionComplete !== false,
    displayDate:date,
    displayText:`${crew} - ${event.displaySummary}${date?` (${date})`:''} 📌`,
    publishedAt:event.publishedAt,
    sourcePublishedAt:event.sourcePublishedAt||event.publishedAt,
    activityDate:event.activityDate,
    activityDateSource:event.activityDateSource||'event-cluster',
    publicVerification:'event_cluster',
    imageUrl:event.imageUrl||'',
    sheetImageUrl:event.sheetImageUrl||'',
    imageSource:event.imageSource||'none',
    imagePostId:event.imagePostId||'',
    imageSuitabilityScore:event.imageSuitabilityScore ?? null,
    imageRejected:false,
    fallbackVodUrl:event.fallbackVodUrl||'',
    fingerprint,
    representativeTier:event.representativeTier||2,
    isCrewLeader:Boolean(event.isCrewLeader)
  };
}

async function enrichPayload(req, payload, requestUrl) {
  if (!payload || payload.ok!==true || payload.preservePrevious===true || !payload.strictCrew || !enrichment.needsEnrichment(payload.selected)) return payload;
  const crew=String(payload.strictCrew||'');
  const stations=safeStations(requestUrl.searchParams.get('stations')||'');
  const leaderStation=LEADER_BY_CREW[crew]||'';
  const rawPosts=await collectRawPosts(req,stations,crew,requestUrl.searchParams.get('refresh')==='1');
  const event=enrichment.synthesizeCrewEvent(rawPosts,crew,leaderStation);
  if (!event) return payload;

  const shouldUse=enrichment.shouldReplaceCore(payload.selected,event) || sameEvent(payload.selected,event);
  if (!shouldUse) return payload;

  let enrichedEvent=enrichment.attachBestImage(event,rawPosts,[],leaderStation);
  if (!enrichedEvent.imageUrl) {
    const vods=await collectLeaderVods(req,leaderStation,enrichedEvent.activityDate);
    enrichedEvent=enrichment.attachBestImage(enrichedEvent,rawPosts,vods,leaderStation);
  }

  const fingerprint=core._internals.stableFingerprint(toCoreFingerprintInput(crew,enrichedEvent));
  const previousFingerprint=String(payload.previousFingerprint||'');
  const unchanged=Boolean(fingerprint&&previousFingerprint&&fingerprint===previousFingerprint);
  const preservePrevious=Boolean(payload.preservePrevious);

  return {
    ...payload,
    policyVersion:POLICY_VERSION,
    healthStatus:'healthy',
    preservePrevious:false,
    selectedFingerprint:fingerprint,
    unchanged,
    shouldWrite:!preservePrevious&&!unchanged,
    updateAction:unchanged?'skip_unchanged':'write',
    selected:buildSelected(crew,enrichedEvent,fingerprint),
    eventClusterVersion:'event-cluster-v1'
  };
}

module.exports=async function handler(req,res) {
  const captured=captureRes();
  await core(req,captured);
  copyHeaders(res,captured.state.headers);
  if (captured.state.statusCode<200 || captured.state.statusCode>=300 || !captured.state.body) {
    return res.status(captured.state.statusCode).json(captured.state.body);
  }
  let body=captured.state.body;
  try {
    const requestUrl=new URL(req.url||'/','https://crew-news.local');
    body=await enrichPayload(req,body,requestUrl);
  } catch (_) {
    body=captured.state.body;
  }
  res.setHeader('X-Crew-News-Policy',POLICY_VERSION);
  res.setHeader('X-Crew-News-Enrichment','event-cluster-v1');
  return res.status(captured.state.statusCode).json(body);
};

module.exports._internals={
  ...core._internals,
  ...enrichment,
  safeStations,
  captureRes,
  sameEvent,
  buildSelected,
  enrichPayload
};
