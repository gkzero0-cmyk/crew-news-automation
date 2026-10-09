'use strict';

const DEFAULT_BLANK_SHEET_IMAGE_URL='https://crew-news-automation.vercel.app/api/blank-image';

function normalize(value='') {
  return String(value||'')
    .toLowerCase()
    .replace(/<[^>]+>/g,' ')
    .replace(/[\s\u200b\u00a0]+/g,'')
    .replace(/[\[\](){}<>「」『』“”'".,!?~·:;_\-|]+/g,'');
}

function stripCrewPrefix(value='', crew='') {
  const raw=String(value||'').replace(/\s+/g,' ').trim();
  const crewRaw=String(crew||'').replace(/\s+/g,' ').trim();
  if (!raw || !crewRaw) return raw;
  const crewNorm=normalize(crewRaw);
  const rawNorm=normalize(raw);
  if (!rawNorm.startsWith(crewNorm)) return raw;

  const escaped=crewRaw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return raw.replace(new RegExp('^'+escaped+'(?:\\s*[-–—:]?\\s*)?','i'),'').trim() || raw;
}

function selectedPostFromPayload(payload) {
  const selected=payload&&payload.selected;
  if (!selected) return null;
  const id=String(selected.id||'');
  if (!id) return null;
  for (const result of payload.results||[]) {
    for (const post of (result&&result.posts)||[]) {
      if (String(post&&post.id||'')===id) return post;
    }
  }
  return null;
}

function selectedEvidenceText(payload) {
  const selected=payload&&payload.selected||{};
  const post=selectedPostFromPayload(payload)||{};
  return [
    post.originalTitle,post.title,post.contents,
    selected.originalTitle,selected.title,selected.contents,
    selected.displaySummary,selected.summary
  ].filter(Boolean).join('\n');
}

function isExplicitCrewRecruitment(text='') {
  const raw=String(text||'');
  return /(?:크루원|크루\s*멤버|신입\s*(?:크루원|멤버)|신규\s*(?:크루원|멤버)|새\s*멤버|멤버\s*충원|영입)[^.!?\n]{0,50}모집|모집[^.!?\n]{0,50}(?:크루원|크루\s*멤버|신입\s*(?:크루원|멤버)|신규\s*(?:크루원|멤버)|새\s*멤버|멤버\s*충원)/i.test(raw);
}

function cleanNamedActivity(value='') {
  return String(value||'')
    .replace(/^\s*(?:20\d{2}[./-])?\d{1,2}[./-]\d{1,2}\s*/,'')
    .replace(/^\s*(?:오늘|내일|모레)\s*/,'')
    .replace(/\s+/g,' ')
    .trim();
}

function namedRecruitmentActivity(text='') {
  const lines=String(text||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
  const suffix='(?:게임|콘텐츠|컨텐츠|대회|프로젝트)';
  const before=new RegExp('([가-힣A-Za-z0-9][가-힣A-Za-z0-9+._ -]{1,28}'+suffix+')[^.!?\\n]{0,50}모집','i');
  const after=new RegExp('모집[^.!?\\n]{0,50}([가-힣A-Za-z0-9][가-힣A-Za-z0-9+._ -]{1,28}'+suffix+')','i');
  for (const line of lines) {
    if (!/모집/i.test(line)) continue;
    const match=line.match(before)||line.match(after);
    if (!match) continue;
    const candidate=cleanNamedActivity(match[1]);
    if (candidate.length>=3 && candidate.length<=32) return candidate.replace(/컨텐츠/gi,'콘텐츠');
  }
  return '';
}

function namedTournamentOutcome(text='') {
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const match=raw.match(/([가-힣A-Za-z0-9_][가-힣A-Za-z0-9_ .+_-]{1,36}?대회)\s*["“]([^"”\n]{1,24})["”]\s*([가-힣A-Za-z0-9_]{1,20}?)(?:의)?\s*우승(?:을)?\s*축하/i);
  if (!match) return '';
  const tournament=String(match[1]||'').replace(/\s+/g,' ').trim();
  const team=String(match[2]||'').replace(/\s+/g,' ').trim();
  const person=String(match[3]||'').replace(/\s+/g,' ').trim();
  if (!tournament || !team || !person) return '';
  return tournament+' "'+team+'" '+person+' 우승 축하';
}

function inferSpecificActivity(text='', currentActivity='') {
  const raw=String(text||'');
  const current=String(currentActivity||'').trim();

  if (/^(?:합격|축하|합격 축하)$/i.test(current) && /릴파의?\s*VR\s*포인트\s*컬링\s*대회\s*출전\s*합격/i.test(raw)) return '릴파의 VR 포인트 컬링 대회 출전 합격 축하';
  if (/^(?:대회|행사|콘텐츠|컨텐츠)$/i.test(current)) {
    const tournamentOutcome=namedTournamentOutcome(raw);
    if (tournamentOutcome) return tournamentOutcome;
  }
  if (/버추얼\s*크루원/i.test(raw) && /인턴/i.test(raw) && /모집/i.test(raw)) return '버추얼 크루원 인턴 모집';
  if (/peak/i.test(raw) && /합방/i.test(raw) && /합방|콘텐츠|컨텐츠|모임/i.test(current)) return 'PEAK 합방';
  if (/뇌피셜\s*게임/i.test(raw)) return '뇌피셜 게임';
  if (/나들이/i.test(raw) && /합방|콘텐츠|컨텐츠|모임|나들이/i.test(current)) return '나들이';

  if (/모집/i.test(current)) {
    if (isExplicitCrewRecruitment(raw)) return '';
    const named=namedRecruitmentActivity(raw);
    if (named) return named;
  }

  return '';
}

function refinedDisplayLabel(crew='', currentActivity='', inferred='', evidence='') {
  if (!inferred) return '';
  const crewRaw=String(crew||'').trim();
  const current=String(currentActivity||'').trim();
  const raw=String(evidence||'');

  if (inferred==='나들이' && crewRaw && /합방|모임|콘텐츠|컨텐츠|나들이/i.test(current)) {
    const escaped=crewRaw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if (new RegExp(escaped+'\\s*나들이','i').test(raw)) return crewRaw+' 나들이';
  }
  return inferred;
}

function isGenericActivityLabel(value='') {
  return /^(?:모집|합방|콘텐츠|컨텐츠|일정|행사|모임|대회|면접)$/i.test(String(value||'').trim());
}

function displayDate(selected) {
  const existing=String(selected&&selected.displayDate||'').trim();
  if (existing) return existing;
  const iso=String(selected&&selected.activityDate||'').slice(0,10);
  const m=iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

function applyEditorialTitle(payload) {
  if (!payload || !payload.selected || payload.preservePrevious===true) return {payload,changed:false};
  const crew=String(payload.strictCrew||payload.selected.strictCrew||'').trim();
  if (!crew) return {payload,changed:false};

  const selected={...payload.selected};
  const currentRaw=String(selected.displaySummary||selected.summary||'').replace(/\s+/g,' ').trim();
  const currentActivity=stripCrewPrefix(currentRaw,crew);
  const evidence=selectedEvidenceText(payload);
  const inferred=inferSpecificActivity(evidence,currentActivity);
  const label=inferred
    ? refinedDisplayLabel(crew,currentActivity,inferred,evidence)
    : (isGenericActivityLabel(currentActivity) ? currentActivity : currentRaw);
  if (!label) return {payload,changed:false};

  const date=displayDate(selected);
  const canonicalText=`${crew} - ${label}${date?` (${date})`:''} 📌`;
  const changed=Boolean(
    inferred ||
    selected.displaySummary!==label ||
    selected.displayText!==canonicalText
  );

  if (inferred) selected.summary=inferred;
  selected.displaySummary=label;
  selected.displayText=canonicalText;

  return {payload:{...payload,selected},changed};
}

function ensureBlankImageDirective(payload, blankUrl=DEFAULT_BLANK_SHEET_IMAGE_URL) {
  if (!payload || !payload.selected || payload.preservePrevious===true) return {payload,changed:false};
  const selected={...payload.selected};
  const hasRealImage=Boolean(String(selected.imageUrl||'').trim());
  const hasSheetImage=Boolean(String(selected.sheetImageUrl||'').trim());
  if (hasRealImage || hasSheetImage) return {payload,changed:false};

  selected.imageUrl='';
  selected.sheetImageUrl=blankUrl;
  selected.imageSource=selected.imageSource||'none';
  selected.imageSelectionReason=selected.imageSelectionReason||'적합 이미지 없음';
  return {payload:{...payload,selected},changed:true};
}

function selectedFingerprintInput(payload) {
  const selected=payload&&payload.selected||{};
  return {
    id:selected.id,
    strictCrew:String(payload&&payload.strictCrew||selected.strictCrew||''),
    strictActivity:selected.summary||selected.strictActivity||'',
    displaySummary:selected.displaySummary||'',
    activityDate:selected.activityDate||'',
    publishedAt:selected.publishedAt||'',
    sourcePublishedAt:selected.sourcePublishedAt||'',
    imageUrl:selected.imageUrl||'',
    imageSource:selected.imageSource||'none'
  };
}

function refreshFingerprintState(payload, stableFingerprint, forceWrite=false) {
  if (!payload || !payload.selected || typeof stableFingerprint!=='function') return payload;
  const fingerprint=stableFingerprint(selectedFingerprintInput(payload));
  const previousFingerprint=String(payload.previousFingerprint||'');
  const unchanged=Boolean(fingerprint&&previousFingerprint&&fingerprint===previousFingerprint);
  const shouldWrite=forceWrite ? true : !unchanged;
  return {
    ...payload,
    selectedFingerprint:fingerprint,
    unchanged:forceWrite ? false : unchanged,
    shouldWrite,
    updateAction:shouldWrite?'write':'skip_unchanged',
    selected:{...payload.selected,fingerprint}
  };
}

const LEADER_BY_CREW_AUDIT=Object.freeze({
  '조적단':'yjkim5500','강씨세가':'rkdakstlr911','진드기':'jangjh5409','천타버스':'243000',
  'ZZAM지트':'zzamta0310','장지수용소':'iamquaddurup','머리퍼리':'beemong','자라섬':'dstv'
});

function isIndividualExternalPromotionAuditPost(post,crew) {
  if (!post || !crew) return false;
  const station=String(post.station||post.authorId||'').trim();
  const leader=String(LEADER_BY_CREW_AUDIT[crew]||'').trim();
  if (station && leader && station===leader) return false;
  const boardKey=String(post.boardName||'').toLowerCase().replace(/[^가-힣a-z0-9]+/g,'');
  if (!['업','up','재따봉','업게시판','up게시판'].includes(boardKey)) return false;
  const text=`${post.originalTitle||post.title||''}\n${post.contents||''}`;
  const crewWide=/(?:크루|크루원|멤버|전원|단체|팀)(?:\s*단위|\s*전체|\s*으로|\s*이|\s*가|\s*은|\s*는|\s*과|\s*와)?[^.!?\n]{0,35}(?:참가|참여|출전)|(?:참가|참여|출전)[^.!?\n]{0,35}(?:크루|크루원|멤버|전원|단체|팀)(?:\s*단위|\s*전체|\s*으로)?/i.test(text);
  return !crewWide;
}

function candidateAuditEntry(post,decision,reason) {
  if (!post) return null;
  return {
    decision:String(decision||'후보'),id:String(post.id||''),station:String(post.station||post.authorId||''),
    author:String(post.author||''),publishedAt:String(post.sourcePublishedAt||post.publishedAt||''),
    activity:String(post.displaySummary||post.summary||post.strictActivity||post.title||''),reason:String(reason||''),
    postUrl:String(post.postUrl||''),imageSource:String(post.imageSource||'')
  };
}

function attachCandidateAudit(payload,limit=10) {
  if (!payload || typeof payload!=='object') return payload;
  const crew=String(payload.strictCrew||'');
  const selected=payload.selected||null;
  const entries=[];
  const seen=new Set();
  let eligibleCount=0;
  let rejectedCount=0;
  if (selected) {
    const entry=candidateAuditEntry(selected,'선택',selected.selectionReason||'최신·적합 대표 소식');
    if (entry) { entries.push(entry); if(entry.id) seen.add(entry.id); eligibleCount+=1; }
  }
  const posts=[];
  for (const result of payload.results||[]) {
    for (const post of (result&&result.posts)||[]) posts.push({...post,station:String(post&&post.station||result&&result.station||post&&post.authorId||'')});
  }
  posts.sort((a,b)=>Date.parse(String(b.sourcePublishedAt||b.publishedAt||'').replace(' ','T'))-Date.parse(String(a.sourcePublishedAt||a.publishedAt||'').replace(' ','T')));
  for (const post of posts) {
    const id=String(post&&post.id||'');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    if (isIndividualExternalPromotionAuditPost(post,crew)) { entries.push(candidateAuditEntry(post,'제외','개인 외부 콘텐츠 UP 홍보')); rejectedCount+=1; continue; }
    entries.push(candidateAuditEntry(post,'후보','적합 후보이나 더 우선순위 높은 소식 존재'));
    eligibleCount+=1;
  }
  const completeHealthy=Boolean(payload.ok===true&&payload.complete===true&&payload.healthStatus==='healthy'&&payload.preservePrevious!==true&&Number(payload.failed||0)===0&&Number(payload.auxiliaryFailed||0)===0);
  const clearVerified=Boolean(!selected&&payload.reliableEmpty===true&&completeHealthy&&eligibleCount===0);
  return {...payload,candidateAuditVersion:'candidate-audit-v1',candidateAudit:entries.filter(Boolean).slice(0,Math.max(1,Number(limit)||10)),candidateAuditComplete:completeHealthy,eligibleCandidateCount:eligibleCount,rejectedCandidateCount:rejectedCount,clearVerified,clearEvaluationCount:Number(payload.rawCandidateCount||posts.length||0)};
}

function applyOutputPolicy(payload, options={}) {
  if (!payload || payload.ok!==true) return payload;
  if (!payload.selected || payload.preservePrevious===true) return attachCandidateAudit(payload);
  const titleResult=applyEditorialTitle(payload);
  const imageResult=ensureBlankImageDirective(titleResult.payload,options.blankUrl||DEFAULT_BLANK_SHEET_IMAGE_URL);
  const changed=titleResult.changed||imageResult.changed;
  return attachCandidateAudit(refreshFingerprintState(imageResult.payload,options.stableFingerprint,changed));
}

module.exports={
  DEFAULT_BLANK_SHEET_IMAGE_URL,
  normalize,
  stripCrewPrefix,
  selectedPostFromPayload,
  selectedEvidenceText,
  isExplicitCrewRecruitment,
  namedRecruitmentActivity,
  namedTournamentOutcome,
  inferSpecificActivity,
  refinedDisplayLabel,
  isGenericActivityLabel,
  applyEditorialTitle,
  ensureBlankImageDirective,
  selectedFingerprintInput,
  refreshFingerprintState,
  isIndividualExternalPromotionAuditPost,
  candidateAuditEntry,
  attachCandidateAudit,
  applyOutputPolicy
};