'use strict';

const core = require('../internal/crew-news-batch-core.js');
const crewNewsHandler = require('../internal/crew-news.js');
const enrichment = require('../lib/event-enrichment.js');
const outputPolicy = require('../lib/output-policy.js');
const vodPolicy = require('../lib/editorial-vod-policy.js');
const vodConsensusPolicy = require('../lib/vod-consensus-policy.js');
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

const BLANK_SHEET_IMAGE_URL='https://crew-news-automation.vercel.app/api/blank-image';
const VOD_CONSENSUS_MAX_STATIONS=4;
const VOD_CONSENSUS_MAX_EVENT_AGE_DAYS=3;
const VOD_CONSENSUS_LIST_CACHE_TTL_MS=60*60*1000;
const VOD_CONSENSUS_DETAIL_CACHE_TTL_MS=6*60*60*1000;
const vodConsensusListCache=new Map();
const vodConsensusDetailCache=new Map();

function safeStations(raw='') {
  return [...new Set(String(raw||'').split(',').map(v=>v.trim()).filter(v=>/^[A-Za-z0-9_-]{2,64}$/.test(v)))].slice(0,20);
}

function captureRes() {
  const state={statusCode:200,headers:{},body:null};
  return {
    state,
    setHeader(name,value){ state.headers[String(name).toLowerCase()]=value; },
    status(code){ state.statusCode=Number(code)||200; return this; },
    json(body){ state.body=body; return body; },
    end(payload){
      if (payload != null && state.body == null) {
        try { state.body=JSON.parse(String(payload)); } catch (_) { state.body=payload; }
      }
      return payload;
    }
  };
}

async function invoke(handler, req, url) {
  const fakeReq={method:'GET',url,headers:{...((req&&req.headers)||{})}};
  const fakeRes=captureRes();
  await handler(fakeReq,fakeRes);
  return fakeRes.state;
}

function copyHeaders(res, headers={}) {
  for (const [name,value] of Object.entries(headers||{})) {
    try { res.setHeader(name,v...[truncated]
function selectedPostFromPayload(payload) {
  if (!payload || !payload.selected) return null;
  const id=String(payload.selected.id||'');
  if (!id) return null;
  for (const result of payload.results||[]) {
    for (const post of (result&&result.posts)||[]) {
      if (String(post&&post.id||'')===id) return post;
    }
  }
  return null;
}

function isExternalParticipationRecapSelected(payload) {
  if (!payload || !payload.selected) return false;
  const activity=String(payload.selected.summary||payload.selected.displaySummary||'');
  if (!/(?:면접|합방|회의|콘텐츠|컨텐츠)/i.test(activity)) return false;
  const post=selectedPostFromPayload(payload);
  if (!post) return false;
  const text=`${post.originalTitle||post.title||''}\n${post.contents||''}`;
  return /(?:방송|채널)에서[^.!?\n]{0,80}(?:면접|합방|회의|콘텐츠|컨텐츠)[^.!?\n]{0,40}(?:보고|하고)\s*왔/i.test(text) ||
    /(?:면접|합방|회의|콘텐츠|컨텐츠)[^.!?\n]{0,30}(?:보고|하고)\s*왔/i.test(text);
}

function isIndividualExternalPromotionPost(post, crew, station='') {
  if (!post || !crew) return false;
  const stationId=String(station||post.station||post.authorId||'').trim();
  const leaderStation=String(LEADER_BY_CREW[crew]||'').trim();
  if (stationId && leaderStation && stationId===leaderStation) return false;

  const boardKey=String(post.boardName||'')
    .toLowerCase()
    .replace(/[^가-힣a-z0-9]+/g,'');
  const personalPromoBoard=['업','up','재따봉','업게시판','up게시판'].includes(boardKey);
  if (!personalPromoBoard) return false;

  const text=`${post.originalTitle||post.title||''}\n${post.contents||''}`;
  const explicitCrewWideParticipation=/(?:크루|크루원|멤버|전원|단체|팀)(?:\s*단위|\s*전체|\s*으로|\s*이|\s*가|\s*은|\s*는|\s*과|\s*와)?[^.!?\n]{0,35}(?:참가|참여|출전)|(?:참가|참여|출전)[^.!?\n]{0,35}(?:크루|크루원|멤버|전원|단체|팀)(?:\s*단위|\s*전체|\s*으로)?/i.test(text);
  return !explicitCrewWideParticipation;
}

function isIndividualExternalPromotionSelected(payload) {
  if (!payload || !payload.selected) return false;
  const post=selectedPostFromPayload(payload);
  if (!post) return false;
  const crew=...[truncated]
async function collectRawPosts(req, stations, crew, forceRefresh) {
  const all=[];
  const targets=[...new Set([...stations,...(enrichment.AUXILIARY_VALIDATORS[crew]||[])])];
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

async function recoverPreviousEligibleSelection(req,payload,requestUrl) {
  if (!payload || payload.ok!==true || !payload.strictCrew) return payload;
  const crew=String(payload.strictCrew||'');
  const stations=safeStations(requestUrl.searchParams.get('stations')||'');
  const rawPosts=await collectRawPosts(req,stations,crew,requestUrl.searchParams.get('refresh')==='1');
  const recovered=selectLatestEligibleCandidate(rawPosts,crew);
  if (!recovered) return clearInvalidSelection(payload);
  return {
    ...payload,
    healthStatus:'healthy',
    preservePrevious:false,
    suspiciousEmpty:false,
    reliableEmpty:false,
    selected:recovered,
    selectedFingerprint:'',
    unchanged:false,
    shouldWrite:true,
    updateAction:'write',
    eventClusterVersion:'event-cluster-v1'
  };
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
    for (con...[truncated]  map.set(key,{at:Date.now(),value});
  if (map.size>maxSize) {
    const oldest=[...map.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
    if (oldest) map.delete(oldest[0]);
  }
}

async function fetchVodListForConsensus(req,station) {
  const key=String(station||'');
  const cached=cacheRead(vodConsensusListCache,key,VOD_CONSENSUS_LIST_CACHE_TTL_MS);
  if (cached) return {vods:cached,cacheHit:true};
  try {
    const path='/api/crew-news?station='+encodeURIComponent(key)+'&mode=vods&per_page=30';
    const result=await invoke(crewNewsHandler,req,path);
    const vods=result.statusCode>=200 && result.statusCode<300 && result.body && result.body.ok===true
      ? (result.body.vods||[])
      : [];
    cacheWrite(vodConsensusListCache,key,vods);
    return {vods,cacheHit:false};
  } catch (_) {
    return {vods:[],cacheHit:false};
  }
}

async function fetchVodDetailForConsensus(req,station,id) {
  const key=String(station||'')+':'+String(id||'');
  const cached=cacheRead(vodConsensusDetailCache,key,VOD_CONSENSUS_DETAIL_CACHE_TTL_MS);
  if (cached) return {vod:cached,cacheHit:true};
  try {
    const path='/api/crew-news?station='+encodeURIComponent(station)+'&mode=vod-detail&title_no='+encodeURIComponent(id);
    const result=await invoke(crewNewsHandler,req,path);
    const vod=result.statusCode>=200 && result.statusCode<300 && result.body && result.body.ok===true
      ? (result.body.vod||null)
      : null;
    if (vod) cacheWrite(vodConsensusDetailCache,key,vod);
    return {vod,cacheHit:false};
  } catch (_) {
    return {vod:null,cacheHit:false};
  }
}

async function attachVodConsensusFallback(req,payload,requestUrl,now=new Date()) {
  if (!shouldAttemptVodConsensus(payload,now)) return payload;
  const crew=String(payload.strictCrew||'');
  const selected=payload.selected||{};
  const stations=consensusStationOrder(payload,requestUrl);
  if (stations.length<2) return payload;

  const vodsByStation=new Map();
  let consensus=null;
  let networkListRequests=0;
 ...[truncated]      nextSelected.sheetImageUrl=detail.sheetImageUrl||detail.imageUrl;
      nextSelected.imageSource='member_vod_consensus';
      nextSelected.imageSelectionReason='멀티멤버 VOD 공통 활동명 일치';
      nextSelected.fallbackVodUrl=vod.vodUrl||('https://vod.sooplive.com/player/'+vod.id);
      break;
    }
  }
  nextSelected.vodConsensusDetailRequests=networkDetailRequests;

  return outputPolicy.refreshFingerprintState(
    {...payload,selected:nextSelected},
    core._internals.stableFingerprint,
    true
  );
}

async function attachEditorialVodFallback(req,payload) {
  if (!payload || payload.ok!==true || !payload.selected || payload.preservePrevious===true) return payload;
  if (String(payload.selected.imageUrl||'').trim()) return payload;
  const crew=String(payload.strictCrew||'');
  const leaderStation=LEADER_BY_CREW[crew]||'';
  if (!leaderStation) return payload;

  try {
    const list=await invoke(crewNewsHandler,req,`/api/crew-news?station=${encodeURIComponent(leaderStation)}&mode=vods&per_page=20`);
    if (list.statusCode<200 || list.statusCode>=300 || !list.body || list.body.ok!==true) return payload;
    const candidate=vodPolicy.chooseVodCandidate(payload.selected,list.body.vods||[]);
    if (!candidate || !candidate.id) return payload;

    const detail=await invoke(crewNewsHandler,req,`/api/crew-news?station=${encodeURIComponent(leaderStation)}&mode=vod-detail&title_no=${encodeURIComponent(candidate.id)}`);
    const vod=detail.body&&detail.body.vod;
    if (!vod || !vod.imageUrl) return payload;

    const selected={
      ...payload.selected,
      imageUrl:vod.imageUrl,
      sheetImageUrl:vod.sheetImageUrl||vod.imageUrl,
      imageSource:'leader_vod_editorial',
      imageSelectionReason:'구체 활동명 일치 크루장 VOD',
      imagePostId:'',
      fallbackVodUrl:candidate.vodUrl||`https://vod.sooplive.com/player/${candidate.id}`
    };
    return outputPolicy.refreshFingerprintState(
      {...payload,selected},
      core._internals.stableFingerprint,
      tru...[truncated]}

function clearInvalidSelection(payload) {
  return {
    ...payload,
    healthStatus:'healthy',
    preservePrevious:false,
    suspiciousEmpty:false,
    reliableEmpty:true,
    selected:null,
    selectedFingerprint:'',
    unchanged:false,
    shouldWrite:true,
    updateAction:'clear_invalid_selection',
    eventClusterVersion:'event-cluster-v1'
  };
}

async function enrichPayload(req, payload, requestUrl) {
  if (!shouldAttemptEnrichment(payload)) return payload;
  const crew=String(payload.strictCrew||'');
  const stations=safeStations(requestUrl.searchParams.get('stations')||'');
  const leaderStation=LEADER_BY_CREW[crew]||'';
  const invalidCore=isExternalParticipationRecapSelected(payload);
  const rawPosts=await collectRawPosts(req,stations,crew,requestUrl.searchParams.get('refresh')==='1');
  const event=enrichment.synthesizeCrewEvent(rawPosts,crew,leaderStation);
  if (!event) return invalidCore ? clearInvalidSelection(payload) : payload;

  const shouldUse=invalidCore || enrichment.shouldReplaceCore(payload.selected,event) || sameEvent(payload.selected,event,selectedPostFromPayload(payload));
  if (!shouldUse) return payload;

  let enrichedEvent={...event};
  let leaderVods=null;
  const verifiedVodId=enrichment.verifiedVodIdFor(crew,event);

  if (verifiedVodId) {
    leaderVods=await collectLeaderVods(req,leaderStation,event.activityDate);
    const verified=leaderVods
      .filter(v=>String(v.id||'')===String(verifiedVodId))
      .map(v=>({...v,verifiedEventMedia:true}));
    enrichedEvent=enrichment.attachBestImage(enrichedEvent,[],verified,leaderStation);
  }

  if (!enrichedEvent.imageUrl) {
    enrichedEvent=enrichment.attachBestImage(enrichedEvent,rawPosts,[],leaderStation);
  }
  if (!enrichedEvent.imageUrl) {
    leaderVods=leaderVods || await collectLeaderVods(req,leaderStation,enrichedEvent.activityDate);
    enrichedEvent=enrichment.attachBestImage(enrichedEvent,[],leaderVods,leaderStation);
  }

  const fingerprint=core._internals....[truncated]  ...core._internals,
  ...enrichment,
  ...outputPolicy,
  ...vodPolicy,
  ...vodConsensusPolicy,
  safeStations,
  captureRes,
  sameEvent,
  selectedPostFromPayload,
  isExternalParticipationRecapSelected,
  isIndividualExternalPromotionPost,
  isIndividualExternalPromotionSelected,
  selectLatestEligibleCandidate,
  recoverPreviousEligibleSelection,
  hasLinkedRepresentativeSourceSelected,
  shouldAttemptEnrichment,
  buildSelected,
  clearInvalidSelection,
  enrichPayload,
  consensusStationOrder,
  shouldAttemptVodConsensus,
  fetchVodListForConsensus,
  fetchVodDetailForConsensus,
  attachVodConsensusFallback,
  attachEditorialVodFallback,
  VOD_CONSENSUS_MAX_STATIONS,
  VOD_CONSENSUS_MAX_EVENT_AGE_DAYS,
  BLANK_SHEET_IMAGE_URL
};
