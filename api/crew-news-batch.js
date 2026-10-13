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
const VOD_CONSENSUS_IMAGE_MAX_STATIONS=8;
const VOD_CONSENSUS_IMAGE_MAX_DETAILS=4;
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

function sameEvent(coreSelected,event,sourcePost=null) {
  if (!coreSelected || !event) return false;

  const eventId=String(event.id||'').trim();
  if (/^[0-9]+$/.test(eventId) && sourcePost) {
    const sourceText=[sourcePost.originalTitle,sourcePost.title,sourcePost.contents,sourcePost.postUrl]
      .filter(Boolean).join('\n');
    if (sourceText.includes('/post/'+eventId)) return true;
  }

  const coreText=String(coreSelected.displaySummary||coreSelected.summary||'');
  const coreNorm=enrichment.normalize(coreText);
  const eventActivityNorm=enrichment.normalize(event.activity||'');
  const eventDisplayNorm=enrichment.normalize(event.displaySummary||'');
  const coreSummaryNorm=enrichment.normalize(coreSelected.summary||'');
  const activityMatches=Boolean(
    coreNorm && eventActivityNorm && (
      coreNorm.includes(eventActivityNorm) ||
      eventActivityNorm.includes(coreNorm) ||
      (eventDisplayNorm && coreSummaryNorm && eventDisplayNorm.includes(coreSummaryNorm))
    )
  );
  if (!activityMatches) return false;

  const coreDate=String(coreSelected.activityDate||'').slice(0,10);
  const eventDate=String(event.activityDate||'').slice(0,10);
  return Boolean(coreDate && eventDate && coreDate===eventDate);
}

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
  const crew=String(payload.strictCrew||'');
  const station=String(payload.selected.station||post.station||post.authorId||'').trim();
  return isIndividualExternalPromotionPost(post,crew,station);
}

function selectLatestEligibleCandidate(rawPosts, crew) {
  if (!crew) return null;
  const candidates=[];
  for (const rawPost of Array.isArray(rawPosts)?rawPosts:[]) {
    if (!rawPost) continue;
    const station=String(rawPost.station||rawPost.authorId||'').trim();
    if (isIndividualExternalPromotionPost(rawPost,crew,station)) continue;
    const candidate=core._internals.strictCrewPost(rawPost,crew,station);
    if (!candidate) continue;
    candidates.push({...candidate,station:station||candidate.station||candidate.authorId||''});
  }
  const contextual=core._internals.applyContinuousEventContext(candidates);
  contextual.sort(core._internals.compareRepresentativeCandidates);
  const selected=contextual[0]||null;
  if (!selected) return null;

  const originalPostImageUrl=selected.imageUrl||'';
  const originalPostSheetImageUrl=selected.sheetImageUrl||'';
  const chosenPostImage=core._internals.choosePostImageCandidate(selected,contextual);
  return {
    ...selected,
    originalPostImageUrl,
    originalPostSheetImageUrl,
    imageUrl:chosenPostImage?chosenPostImage.imageUrl:'',
    sheetImageUrl:chosenPostImage?chosenPostImage.sheetImageUrl:'',
    imageSource:chosenPostImage?chosenPostImage.imageSource:'none',
    imagePostId:chosenPostImage?chosenPostImage.imagePostId:'',
    imageSuitabilityScore:chosenPostImage?chosenPostImage.imageSuitabilityScore:null,
    imageRejected:Boolean(originalPostImageUrl&&!chosenPostImage)
  };
}

function hasLinkedRepresentativeSourceSelected(payload) {
  if (!payload || !payload.selected) return false;
  const post=selectedPostFromPayload(payload);
  if (!post) return false;
  const selectedId=String(payload.selected.id||'').trim();
  const text=[post.originalTitle,post.title,post.contents,post.postUrl].filter(Boolean).join('\n');
  const matches=[...text.matchAll(/https?:\/\/(?:www\.)?sooplive\.com\/station\/[^\s/]+\/post\/(\d+)/gi)];
  return matches.some(match=>String(match[1]||'') && String(match[1])!==selectedId);
}

function shouldAttemptEnrichment(payload) {
  if (!payload || payload.ok!==true || !payload.strictCrew) return false;
  if (isExternalParticipationRecapSelected(payload)) return true;
  if (hasLinkedRepresentativeSourceSelected(payload)) return true;
  if (!enrichment.needsEnrichment(payload.selected)) return false;
  if (payload.preservePrevious===true && payload.healthStatus!=='suspicious_empty') return false;
  return true;
}

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
    for (const vod of candidates) {
      try {
        const detail=await invoke(crewNewsHandler,req,`/api/crew-news?station=${encodeURIComponent(leaderStation)}&mode=vod-detail&title_no=${encodeURIComponent(vod.id)}`);
        const d=detail.body&&detail.body.vod;
        detailed.push({...vod,...(d||{}),publishedAt:vod.publishedAt,station:leaderStation,vodUrl:vod.vodUrl||`https://vod.sooplive.com/player/${vod.id}`});
      } catch (_) {
        detailed.push({...vod,station:leaderStation});
      }
    }
    return detailed;
  } catch (_) {
    return [];
  }
}

function consensusAllStationOrder(payload, requestUrl) {
  const crew=String(payload&&payload.strictCrew||'');
  const selected=payload&&payload.selected||{};
  const requested=requestUrl instanceof URL
    ? safeStations(requestUrl.searchParams.get('stations')||'')
    : safeStations('');
  const evidence=Array.isArray(selected.evidenceStations) ? selected.evidenceStations : [];
  return [...new Set([
    String(selected.station||'').trim(),
    String(LEADER_BY_CREW[crew]||'').trim(),
    ...evidence.map(v=>String(v||'').trim()),
    ...requested
  ].filter(v=>/^[A-Za-z0-9_-]{2,64}$/.test(v)))];
}

function consensusStationOrder(payload, requestUrl) {
  return consensusAllStationOrder(payload,requestUrl).slice(0,VOD_CONSENSUS_MAX_STATIONS);
}

function consensusImageStationOrder(payload, requestUrl) {
  return consensusAllStationOrder(payload,requestUrl).slice(0,VOD_CONSENSUS_IMAGE_MAX_STATIONS);
}

function shouldAttemptVodConsensus(payload, now=new Date()) {
  if (!payload || payload.ok!==true || !payload.selected || payload.preservePrevious===true) return false;
  const selected=payload.selected;
  const activity=String(selected.summary||selected.displaySummary||'').trim();
  if (!vodConsensusPolicy.isGenericForVodConsensus(activity)) return false;
  const activityDate=vodPolicy.toDateOnly(selected.activityDate||selected.publishedAt||'');
  if (!activityDate) return false;
  const today=vodPolicy.kstDateNow(now);
  if (activityDate>today) return false;
  return vodPolicy.dayDistance(activityDate,today)<=VOD_CONSENSUS_MAX_EVENT_AGE_DAYS;
}

function cacheRead(map,key,ttl) {
  const row=map.get(key);
  if (!row) return null;
  if (Date.now()-row.at>=ttl) {
    map.delete(key);
    return null;
  }
  return row.value;
}

function cacheWrite(map,key,value,maxSize=120) {
  map.set(key,{at:Date.now(),value});
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
  const checkedStations=[];

  for (const station of stations) {
    const fetched=await fetchVodListForConsensus(req,station);
    if (!fetched.cacheHit) networkListRequests+=1;
    checkedStations.push(station);
    vodsByStation.set(station,fetched.vods||[]);
    consensus=vodConsensusPolicy.findVodConsensus({
      crew,
      activityDate:selected.activityDate,
      vodsByStation
    });
    if (consensus) break;
  }

  if (!consensus) return payload;

  const displayDate=String(selected.displayDate||'').trim();
  const nextSelected={
    ...selected,
    summary:consensus.label,
    displaySummary:consensus.label,
    displayText:crew+' - '+consensus.label+(displayDate?' ('+displayDate+')':'')+' 📌',
    publicVerification:'vod_consensus',
    vodConsensusSignature:consensus.signature,
    vodConsensusSupportCount:consensus.supportCount,
    vodConsensusSupportStations:consensus.supportStations,
    vodConsensusCheckedStations:checkedStations,
    vodConsensusListRequests:networkListRequests
  };

  let networkDetailRequests=0;
  let networkImageListRequests=0;
  const imageCheckedStations=[...checkedStations];
  if (!String(nextSelected.imageUrl||'').trim()) {
    const allImageStations=consensusImageStationOrder(payload,requestUrl);
    const alreadyChecked=new Set(checkedStations);
    for (const station of allImageStations) {
      if (alreadyChecked.has(station)) continue;
      const fetched=await fetchVodListForConsensus(req,station);
      if (!fetched.cacheHit) networkImageListRequests+=1;
      imageCheckedStations.push(station);
      alreadyChecked.add(station);
      vodsByStation.set(station,fetched.vods||[]);
    }

    const ordered=vodConsensusPolicy.collectCompatibleVodCandidates({
      crew,
      activityDate:selected.activityDate,
      consensus,
      vodsByStation,
      preferredStation:selected.station
    });

    let fallback=null;
    let chosen=null;
    for (const vod of ordered.slice(0,VOD_CONSENSUS_IMAGE_MAX_DETAILS)) {
      const fetched=await fetchVodDetailForConsensus(req,vod.station||'',vod.id);
      if (!fetched.cacheHit) networkDetailRequests+=1;
      const detail=fetched.vod;
      if (!detail || !detail.imageUrl) continue;
      const row={vod,detail};
      if (!fallback) fallback=row;
      if (vodConsensusPolicy.isRepresentativeThumbnailUrl(detail.imageUrl)) {
        chosen=row;
        break;
      }
    }
    if (!chosen) chosen=fallback;

    if (chosen) {
      nextSelected.imageUrl=chosen.detail.imageUrl;
      nextSelected.sheetImageUrl=chosen.detail.sheetImageUrl||chosen.detail.imageUrl;
      nextSelected.imageSource='member_vod_consensus';
      nextSelected.imageSelectionReason=vodConsensusPolicy.isRepresentativeThumbnailUrl(chosen.detail.imageUrl)
        ? '멀티멤버 VOD 대표 썸네일 우선'
        : '멀티멤버 VOD 공통 활동명 일치';
      nextSelected.fallbackVodUrl=chosen.vod.vodUrl||('https://vod.sooplive.com/player/'+chosen.vod.id);
      nextSelected.vodConsensusImageVodId=chosen.vod.id;
      nextSelected.vodConsensusImageStation=chosen.vod.station;
    }
  }
  nextSelected.vodConsensusDetailRequests=networkDetailRequests;
  nextSelected.vodConsensusImageListRequests=networkImageListRequests;
  nextSelected.vodConsensusImageCheckedStations=imageCheckedStations;

  return outputPolicy.refreshFingerprintState(
    {...payload,selected:nextSelected},
    core._internals.stableFingerprint,
    true
  );
}
async function attachEditorialVodFallback(req,payload) {
  if (!payload || payload.ok!==true || !payload.selected || payload.preservePrevious===true) return payload;
  if (String(payload.selected.imageUrl||'').trim() || payload.selected.imageAmbiguous===true) return payload;
  // Meeting VODs and user-confirmed wins need visual evidence, not a matching title.
  if (/회의/.test(String(payload.selected.summary||payload.selected.displaySummary||'')) || outputPolicy.confirmedOutcomeForSelection(payload)) return payload;
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
      true
    );
  } catch (_) {
    return payload;
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
    author:event.author||'',
    postUrl:event.postUrl,
    originalTitle:event.originalTitle||'',
    contents:event.contents||'',
    imageAmbiguous:Boolean(event.imageAmbiguous),
    imageCandidateCount:Number(event.imageCandidateCount||0),
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
    sheetImageUrl:event.sheetImageUrl || (event.imageUrl ? '' : BLANK_SHEET_IMAGE_URL),
    imageSource:event.imageSource||'none',
    imageSelectionReason:event.imageSelectionReason||((event.imageUrl||'')?'대표 게시글 이미지':'적합 이미지 없음'),
    imagePostId:event.imagePostId||'',
    imageSuitabilityScore:event.imageSuitabilityScore ?? null,
    imageRejected:false,
    selectionReason:event.selectionReason||'',
    evidenceCount:Number(event.evidenceCount||0),
    evidenceStations:Array.isArray(event.evidenceStations)?event.evidenceStations:[],
    evidenceAuthors:Array.isArray(event.evidenceAuthors)?event.evidenceAuthors:[],
    fallbackVodUrl:event.fallbackVodUrl||'',
    fingerprint,
    representativeTier:event.representativeTier||2,
    isCrewLeader:Boolean(event.isCrewLeader)
  };
}

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

  const fingerprint=core._internals.stableFingerprint(toCoreFingerprintInput(crew,enrichedEvent));
  const previousFingerprint=String(payload.previousFingerprint||'');
  const unchanged=Boolean(fingerprint&&previousFingerprint&&fingerprint===previousFingerprint);

  return {
    ...payload,
    policyVersion:POLICY_VERSION,
    healthStatus:'healthy',
    preservePrevious:false,
    suspiciousEmpty:false,
    selectedFingerprint:fingerprint,
    unchanged,
    shouldWrite:!unchanged,
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
    if (isIndividualExternalPromotionSelected(body)) {
      body=await recoverPreviousEligibleSelection(req,body,requestUrl);
    } else {
      body=await enrichPayload(req,body,requestUrl);
    }
    body=outputPolicy.applyOutputPolicy(body,{
      blankUrl:BLANK_SHEET_IMAGE_URL,
      stableFingerprint:core._internals.stableFingerprint
    });
    body=await attachVodConsensusFallback(req,body,requestUrl);
    body=await attachEditorialVodFallback(req,body);
    body=outputPolicy.applyFinalImageSafety(body,{
      blankUrl:BLANK_SHEET_IMAGE_URL,
      stableFingerprint:core._internals.stableFingerprint
    });
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
  consensusAllStationOrder,
  consensusStationOrder,
  consensusImageStationOrder,
  shouldAttemptVodConsensus,
  fetchVodListForConsensus,
  fetchVodDetailForConsensus,
  attachVodConsensusFallback,
  attachEditorialVodFallback,
  VOD_CONSENSUS_MAX_STATIONS,
  VOD_CONSENSUS_IMAGE_MAX_STATIONS,
  VOD_CONSENSUS_IMAGE_MAX_DETAILS,
  VOD_CONSENSUS_MAX_EVENT_AGE_DAYS,
  BLANK_SHEET_IMAGE_URL
};
