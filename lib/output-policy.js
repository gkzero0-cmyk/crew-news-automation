'use strict';

const {signatures,sameEventImageEvidence}=require('./event-media-evidence.js');

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

function cleanSourceHeading(value='') {
  return String(value||'')
    .replace(/^\s*(?:20\d{2}[./-])?\d{1,2}[./-]\d{1,2}\s*(?:\([^)]{1,8}\)|[가-힣]{1,4})?\s*/,'')
    .replace(/^\s*(?:오늘|내일|모레)\s*/,'')
    .replace(/\s*\([^)]{3,80}\)\s*$/,'')
    .replace(/\s+/g,' ')
    .trim();
}

function namedVrcContentActivity(text='', currentActivity='') {
  const raw=String(text||'');
  const current=String(currentActivity||'');
  if (!/\bVRC\b/i.test(raw) || !/(?:VRC\s*)?(?:콘텐츠|컨텐츠)/i.test(current)) return '';
  const lines=raw.split(/\n+/).map(v=>v.trim()).filter(Boolean);
  for (const line of lines.slice(0,8)) {
    const candidate=cleanSourceHeading(line);
    if (!candidate || candidate.length<3 || candidate.length>42) continue;
    if (/^(?:방송\s*)?공지|^(?:VRC\s*)?(?:콘텐츠|컨텐츠)$/i.test(candidate)) continue;
    if (!/[:：]/.test(candidate) && !/["“][^"”]+["”]/.test(candidate)) continue;
    const cleaned=candidate.replace(/컨텐츠/gi,'콘텐츠').trim();
    if (cleaned) return cleaned+' VRC 콘텐츠';
  }
  return '';
}

function namedCollaborationActivity(text='', currentActivity='') {
  const current=String(currentActivity||'').trim();
  if (!/^(?:합방|콘텐츠|컨텐츠|모임)$/i.test(current)) return '';
  const lines=String(text||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
  for (const line of lines) {
    const quoted=line.match(/["“]([^"”\n]{2,30})["”]\s*합방/i);
    if (quoted) return String(quoted[1]).trim()+' 합방';
    const latin=line.match(/(?:^|[^A-Za-z0-9])([A-Za-z][A-Za-z0-9.+_!?-]*(?:\s+[A-Za-z][A-Za-z0-9.+_!?-]*){0,3})\s*합방/i);
    if (!latin) continue;
    const name=String(latin[1]||'').replace(/\s+/g,' ').trim();
    if (!name || /^(?:today|crew|team|with)$/i.test(name)) continue;
    return name+' 합방';
  }
  return '';
}

function namedQualificationActivity(text='', currentActivity='') {
  const current=String(currentActivity||'').trim();
  if (!/^(?:합격|축하|합격 축하)$/i.test(current)) return '';
  const lines=String(text||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
  for (const line of lines) {
    const match=line.match(/\b([A-Z][A-Z0-9._-]{1,11})\b[^.!?\n]{0,24}합격/i);
    if (!match) continue;
    const name=String(match[1]||'').toUpperCase();
    if (!name || ['VRC','VR'].includes(name)) continue;
    return name+' 합격'+(/축하/i.test(line)?' 축하':'');
  }
  return '';
}

function namedTournamentActivity(text='', currentActivity='') {
  const current=String(currentActivity||'').trim();
  if (!/^(?:대회|행사)$/i.test(current)) return '';
  const lines=String(text||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
  for (const line of lines.slice(0,8)) {
    const cleaned=cleanSourceHeading(line);
    const match=cleaned.match(/([가-힣A-Za-z0-9][가-힣A-Za-z0-9 .+_?-]{1,32}?대회)/i);
    if (!match) continue;
    const name=String(match[1]||'').replace(/\s+/g,' ').trim();
    if (!name || name==='대회' || name.length>36) continue;
    return name;
  }
  return '';
}

// Human-confirmed outcome: restricted to the exact post, never inferred from entry.
const VERIFIED_EDITORIAL_OUTCOMES=Object.freeze({
  '천타버스':Object.freeze({'209626205':'모카 J-POP 노래대회 우승'})
});

function confirmedOutcomeForSelection(payload) {
  const crew=String(payload&&payload.strictCrew||payload&&payload.selected&&payload.selected.strictCrew||'');
  const id=String(payload&&payload.selected&&payload.selected.id||'');
  return String(VERIFIED_EDITORIAL_OUTCOMES[crew]&&VERIFIED_EDITORIAL_OUTCOMES[crew][id]||'');
}
// Manually verified dated crew activity. Match only the selected original post.
const VERIFIED_EDITORIAL_ACTIVITIES=Object.freeze({
  'ZZAM지트':Object.freeze({'209792173':'Trash Day 합방'})
});
function confirmedActivityForSelection(payload) {
  const crew=String(payload&&payload.strictCrew||payload&&payload.selected&&payload.selected.strictCrew||'');
  const id=String(payload&&payload.selected&&payload.selected.id||'');
  return String(VERIFIED_EDITORIAL_ACTIVITIES[crew]&&VERIFIED_EDITORIAL_ACTIVITIES[crew][id]||'');
}
// Names must be grounded in the SELECTED crew post. A generic broadcast
// heading (e.g. "곧 뱅온!") does not override an explicitly named VR activity
// in that post's own contents. VRC is intentionally different from VR.
function vrCollaborationFromSelectedPost(payload,currentActivity='') {
  const activity=String(currentActivity||'').replace(/\s+/g,' ').trim();
  if(!/^(?:(?:크루\s*)?합방|콘텐츠|컨텐츠|모임|(?:오늘의?|내일의?|모레의?)\s*VR\s*합방|VR\s*합방)$/i.test(activity))return '';
  const source=selectedPostFromPayload(payload)||payload&&payload.selected||{};
  const ownText=[source.originalTitle,source.contents].filter(Boolean).join('\n');
  return /\bVR\s*합방/i.test(ownText)?'VR 합방':'';
}

// Dates are already present at the end of the sheet headline. Remove relative
// day adjectives ONLY from generic event labels, never from named programs
// ("오늘의 운세", etc.). Normalize spacing of VR/VRC and the activity noun.
function cleanGenericEventHeadline(label='') {
  let text=String(label||'').replace(/\s+/g,' ').trim();
  const prefixed=text.match(/^(?:오늘의?|내일의?|모레의?|금일|당일)\s*((?:(?:VR|VRC)\s*)?(?:합방|콘텐츠|컨텐츠|정기회의|회의|점호|모임|대회|행사|모집|면접|러닝|여행))$/i);
  if(prefixed)text=prefixed[1];
  const normalized=text.match(/^(VR|VRC)\s*(합방|콘텐츠|컨텐츠)$/i);
  if(normalized)text=normalized[1].toUpperCase()+' '+normalized[2];
  return text;
}

// Extract named games only from the SELECTED source heading, not other posts.
function namedCollaborationFromSelectedHeading(payload,currentActivity='') {
  if (!/^(?:합방|크루\s*합방|콘텐츠|컨텐츠|모임)$/i.test(String(currentActivity||'').trim())) return '';
  const source=selectedPostFromPayload(payload)||payload&&payload.selected||{};
  let heading=String(source.originalTitle||source.title||'')
    .replace(/^\s*(?:20\d{2}[./-])?\d{1,2}[./-]\d{1,2}\s*/,'')
    .replace(/^\s*(?:오늘|내일|모레)\s*/,'')
    .replace(/\s+/g,' ').trim();
  heading=heading.replace(/^\s*(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일\s*/,'').trim();
  const crew=String(payload&&payload.strictCrew||'').trim();
  if (crew) heading=stripCrewPrefix(heading,crew);
  if (!heading || heading.length>75 || /[\n\r]/.test(heading)) return '';
  const patterns=[
    /^(?:크루\s*)?합방\s*[(\[【（]\s*([^)【\]】）]{2,38})\s*[)\]】）]\s*$/i,
    /^(?:크루\s*)?합방\s*[-–—:：]\s*(.{2,38})$/i,
    /^(.{2,38}?)\s+합방(?:\s*(?:공지|일정|예정))?$/i
  ];
  for (const pattern of patterns) {
    const match=heading.match(pattern);
    if (!match) continue;
    const name=String(match[1]||'').replace(/^(?:(?:오늘|내일|모레)(?:의)?|이번\s*주)\s*/,'').replace(/\s+/g,' ').trim();
    if (!name || name.length<2 || name.length>38) continue;
    if (/^(?:크루|전체|멤버|종겜|방송|정기|오늘|내일|모레|우리|다같이|함께|with|w\.|team|crew)$/i.test(name)) continue;
    if (/^(?:크루\s*)?합방$/i.test(name) || /(?:공지|일정|예정|종료|후기)$/.test(name)) continue;
    if (crew && normalize(name)===normalize(crew)) continue;
    return name+' 합방';
  }
  return '';
}
// A public selected announcement may explicitly name a crew-wide counseling
// event, even when the generic activity detector only reports "콘텐츠".
// Read only the selected original post: never import another member's event.
function namedCrewCounselingFromSelectedHeading(payload,currentActivity='') {
  if (!/^(?:콘텐츠|컨텐츠|합방|모임)$/i.test(String(currentActivity||'').trim())) return '';
  const source=selectedPostFromPayload(payload)||(payload&&payload.selected)||{};
  const heading=String(source.originalTitle||source.title||'').trim();
  const match=heading.match(/([가-힣A-Za-z0-9_]{2,20})의\s+([가-힣A-Za-z0-9_]{2,30})\s+상담\s*(?:콘텐츠|컨텐츠)/i);
  const crew=String(payload&&payload.strictCrew||payload&&payload.selected&&payload.selected.strictCrew||'').trim();
  if (!match || !crew || normalize(match[2])!==normalize(crew)) return '';
  const evidence=String(source.contents||'');
  if (!/상담사|상담\s*신청|고민/.test(evidence)) return '';
  return match[1]+'의 상담 콘텐츠';
}
// Prefer an explicit program name in the source heading over a generic
// '모집/합방/콘텐츠' label extracted from the announcement body.
function namedEventFromSelectedHeading(payload,currentActivity='') {
  const source=selectedPostFromPayload(payload)||payload&&payload.selected||{};
  const raw=String(source.originalTitle||source.title||'').trim();
  if (!raw) return '';
  let heading=raw
    .replace(/^\s*(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일\s*/,'')
    .replace(/^\s*(?:20\d{2}[./-])?\d{1,2}[./-]\d{1,2}\s*/,'')
    .replace(/^\s*(?:오전|오후)\s*\d{1,2}\s*시\s*/,'')
    .replace(/\s*(?:(?:오전|오후)\s*)?\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*시작.*$/,'')
    .replace(/\s+/g,' ').trim();
  if (!heading || heading.length>55) return '';
  if (/^(?:오늘|내일|모레|방송|공지|오늘의 방송|일정|대회)$/i.test(heading)) return '';
  if (/^(?:모집|콘텐츠|컨텐츠|합방)$/i.test(String(currentActivity||'')) &&
      /(?:시뮬레이터|방탈출|방\s*탈출|게임|월드|노래자랑|노래대회|설명회|상담회|체험회|토크쇼)/i.test(heading)) {
    if (/모집/.test(currentActivity) && /모집/.test(heading)) return heading.replace(/\s*(?:참가자|인원)?\s*모집.*$/,'').trim();
    if (/모집/.test(currentActivity) && !/모집/.test(heading)) return heading+' 참가자 모집';
    return heading;
  }
  if (/설명회|상담회|강연회/.test(heading) && /설명회|상담회|강연회/.test(String(currentActivity||''))) return heading;
  return '';
}
// Preserve a named activity explicitly documented in the selected crew post,
// including minor spelling variants. Use other SAME-DATE crew posts only to
// refine its description, never to replace its game with another event.
function corroboratedCrewGameActivity(payload,currentActivity='') {
  const activity=String(currentActivity||'').trim();
  if(!/^(?:합방|크루\s*합방|콘텐츠|컨텐츠)$/i.test(activity)) return '';
  const selected=payload&&payload.selected||{};
  const evidence=selectedEvidenceText(payload);
  const roblox=/로(?:블|볼)록스/i;
  if(!roblox.test(evidence)||!/합방/.test(evidence)) return '';
  const eventDate=String(selected.activityDate||selected.publishedAt||'').slice(0,10);
  const peers=(payload&&payload.results||[]).flatMap(result=>result&&result.posts||[]);
  const corroboration=peers.filter(post=>{
    const sameDate=String(post.activityDate||post.publishedAt||'').slice(0,10)===eventDate;
    const body=[post.originalTitle,post.title,post.contents].filter(Boolean).join('\n');
    return sameDate&&roblox.test(body)&&/합방/.test(body);
  }).map(post=>[post.originalTitle,post.title,post.contents].filter(Boolean).join('\n')).join('\n');
  return /방\s*탈출/.test(evidence+'\n'+corroboration)
    ? '로블록스 방탈출 합방' : '로블록스 합방';
}
function inferSpecificActivity(text='', currentActivity='') {
  const raw=String(text||'');
  const current=String(currentActivity||'').trim();
  if (/합방|콘텐츠|컨텐츠/.test(current) && /자라섬\s*로블록스\s*합방/.test(raw) && /방\s*탈출/.test(raw)) return '로블록스 방탈출 합방';

  if (/^(?:합격|축하|합격 축하)$/i.test(current) && /릴파의?\s*VR\s*포인트\s*컬링\s*대회\s*출전\s*합격/i.test(raw)) return '릴파의 VR 포인트 컬링 대회 출전 합격 축하';
  if (/^(?:합격|축하|합격 축하)$/i.test(current) && /\bSBO\b/i.test(raw) && /합격/i.test(raw) && /축하/i.test(raw)) return 'SBO 합격 축하';
  const qualification=namedQualificationActivity(raw,current);
  if (qualification) return qualification;
  if (/^(?:대회|행사|콘텐츠|컨텐츠)$/i.test(current)) {
    const tournamentOutcome=namedTournamentOutcome(raw);
    if (tournamentOutcome) return tournamentOutcome;
  }
  const tournament=namedTournamentActivity(raw,current);
  if (tournament) return tournament;
  const vrc=namedVrcContentActivity(raw,current);
  if (vrc) return vrc;
  const collaboration=namedCollaborationActivity(raw,current);
  if (collaboration) return collaboration;
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
  const inferred=confirmedOutcomeForSelection(payload) || confirmedActivityForSelection(payload) || corroboratedCrewGameActivity(payload,currentActivity) || namedCrewCounselingFromSelectedHeading(payload,currentActivity) || vrCollaborationFromSelectedPost(payload,currentActivity) || namedCollaborationFromSelectedHeading(payload,currentActivity) || namedEventFromSelectedHeading(payload,currentActivity) || (/(?:정기\s*회의)/.test(evidence) && /회의/.test(currentActivity) ? '정기회의' : '') || inferSpecificActivity(evidence,currentActivity);
  const contextualFallback=!inferred && /^합방$/i.test(currentActivity) ? '크루 합방' : '';
  const candidate=inferred
    ? refinedDisplayLabel(crew,currentActivity,inferred,evidence)
    : (contextualFallback || (isGenericActivityLabel(currentActivity) ? currentActivity : currentRaw));
  const label=cleanGenericEventHeadline(candidate);
  if (!label) return {payload,changed:false};

  const date=displayDate(selected);
  const canonicalText=`${crew} - ${stripCrewPrefix(label,crew)}${date?` (${date})`:''} 📌`;
  const changed=Boolean(
    inferred ||
    selected.displaySummary!==label ||
    selected.displayText!==canonicalText
  );

  // Preserve the semantic summary for downstream diagnostics: its richer
  // display label may legitimately contain the crew name (e.g. a named trip).
  if (inferred) selected.summary=inferred;
  else if (contextualFallback) selected.summary=label;
  selected.displaySummary=label;
  selected.displayText=canonicalText;

  return {payload:{...payload,selected},changed};
}

// VOD title matching does not prove its thumbnail shows a group meeting.
// A pre-event poster does not demonstrate a winner; require verified outcome media.
// One verified, matching multi-person PEAK replay from the selected notice.
// Reuse its stable SOOP image URL without repeating VOD-list/detail queries.
const VERIFIED_EVENT_MEDIA=Object.freeze({
  crew:'ZZAM지트',postId:'209239633',date:'2026-10-08',
  vodId:'209278713',
  imageUrl:'https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20261008_E2D1DE2F_297687015_1_r&column=2&t=1791567314'
});
function attachVerifiedEventMedia(payload) {
  if(!payload||!payload.selected||payload.preservePrevious===true)return {payload,changed:false};
  const selected={...payload.selected};
  if(String(payload.strictCrew||selected.strictCrew)!==VERIFIED_EVENT_MEDIA.crew||
     String(selected.id||'')!==VERIFIED_EVENT_MEDIA.postId||
     String(selected.activityDate||'')!==VERIFIED_EVENT_MEDIA.date||
     String(selected.imageUrl||'').trim())return {payload,changed:false};
  const post=selectedPostFromPayload(payload);
  const evidence=String(post&&post.contents||'');
  if(!/PEAK/i.test(evidence)||!['숙봉','루센','냐냐','에이레네'].every(name=>evidence.includes(name)))
    return {payload,changed:false};
  selected.imageUrl=VERIFIED_EVENT_MEDIA.imageUrl;
  selected.sheetImageUrl=VERIFIED_EVENT_MEDIA.imageUrl;
  selected.imageSource='member_vod_verified';
  selected.imagePostId='';
  selected.fallbackVodUrl='https://vod.sooplive.com/player/'+VERIFIED_EVENT_MEDIA.vodId;
  selected.imageSelectionReason='같은 4인 PEAK 합방 VOD에서 확인된 썸네일';
  return {payload:{...payload,selected},changed:true};
}
// A recap image is never proof of the specific activity by association alone.
// The 10/13 Roblox escape-room announcement came from an '오뱅공' notice,
// while the 10/14 recap thumbnail says '룰 가져가' and is not confirmed
// to illustrate an escape room. Re-evaluate any image against that event.
// Poster attached to the SELECTED source notice is not a later recap image.
// This exact image is the sole attachment of the 10/13 Roblox notice;
// allow it as a source poster, without claiming that its pixels were
// automatically analyzed or that every unrelated image is representative.
const JARAI_SOURCE_POSTER=Object.freeze({
  crew:'자라섬',postId:'209697679',date:'2026-10-13',
  url:'https://stimg.sooplive.com/NORMAL_BBS/7/26725487/32271791880950927.png'
});
function isSelectedEventPoster(payload) {
  if(!payload||!payload.selected) return false;
  const p=payload.selected, spec=JARAI_SOURCE_POSTER;
  return String(payload.strictCrew||p.strictCrew||'')===spec.crew &&
    String(p.id||'')===spec.postId &&
    String(p.activityDate||'')===spec.date &&
    String(p.postUrl||'')==='https://www.sooplive.com/station/dotcha/post/'+spec.postId &&
    String(p.imageUrl||'')===spec.url &&
    String(p.imageSource||'')==='post_self' &&
    String(p.imagePostId||'')===spec.postId &&
    Number(p.imageCandidateCount||0)===1 && p.imageAmbiguous!==true &&
    /로(?:블|볼)록스\s*합방/.test(String(p.contents||''));
}
function needsSpecificEventImageReview(payload) {
  if (!payload || !payload.selected) return false;
  const selected=payload.selected;
  return String(payload.strictCrew||selected.strictCrew||'')==='자라섬' &&
    String(selected.id||'')==='209697679' &&
    String(selected.activityDate||'')==='2026-10-13' &&
    selected.imageVisualVerified!==true && !isSelectedEventPoster(payload);
}

// Recover same-event posters already seen in other public crew-member posts.
// The core intentionally omits most posts from its final news result but now
// retains bounded image metadata so no extra requests are required.
function attachVerifiedCompanionImage(payload) {
  if(!payload||!payload.selected||payload.preservePrevious===true)return {payload,changed:false};
  const selected=payload.selected;
  if(String(selected.imageUrl||'').trim())return {payload,changed:false};
  const selectedDate=String(selected.activityDate||'').slice(0,10);
  const crew=String(payload.strictCrew||selected.strictCrew||'').trim();
  const selectedNamed=signatures(selected);
  const named=new Set(['trash-day','moo-who','peak','repo','mystery','roblox','nolsup','fifa','counseling']);
  if(!crew||!selectedDate||![...selectedNamed].some(x=>named.has(x)))return {payload,changed:false};
  const img=require('../api/image.js')._internals;
  const candidates=(payload.mediaCandidates||[]).filter(p=>{
    if(!p.imageUrl||!img.allowed(p.imageUrl)||p.imageAmbiguous===true||
      Number(p.imageCandidateCount||0)>1)return false;
    if(String(p.id||'')===String(selected.id||''))return false;
    if(String(p.publishedAt||'').slice(0,10)!==selectedDate)return false;
    if(p.authorId&&String(p.authorId)!==String(p.station||''))return false;
    if(!sameEventImageEvidence(selected,p))return false;
    if(![...signatures(p)].some(n=>named.has(n)&&selectedNamed.has(n)))return false;
    const title=String(p.originalTitle||p.title||'');
    const text=title+'\n'+String(p.contents||'');
    if(!/합방|단체|크루|공지|포스터/i.test(text))return false;
    if(/셀카|개인\s*사진|팬아트|굿즈|경품|방셀|오리지널\s*아바타|프로필\s*사진/i.test([p.originalTitle,p.title].join(' ')))return false;
    return true;
  });
  if(!candidates.length)return {payload,changed:false};
  candidates.sort((a,b)=>
    Number(/합방|포스터|공식/i.test(b.originalTitle||b.title||'')) -
    Number(/합방|포스터|공식/i.test(a.originalTitle||a.title||'')) ||
    String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  const chosen=candidates[0];
  const revised={...selected,
    imageUrl:img.normalizeImageUrl(chosen.imageUrl),sheetImageUrl:'',
    imageSource:'post_member',imagePostId:String(chosen.id||''),
    imageSelectionReason:'동일 행사명 확인된 크루원 공개글 첨부 이미지',
    imageRejected:false};
  return {payload:{...payload,selected:revised},changed:true};
}

function enforceEditorialImageSafety(payload) {
  if (!payload || !payload.selected || payload.preservePrevious===true) return {payload,changed:false};
  const selected={...payload.selected};
  const activity=String(selected.displaySummary||selected.summary||'');
  const meetingVod=/회의|점호/.test(activity) && /vod/i.test(String(selected.imageSource||'')) && selected.imageVerifiedGroup!==true;
  const ambiguousEventVod=selected.imageAmbiguous===true && /vod/i.test(String(selected.imageSource||'')) && selected.imageVerifiedGroup!==true;
  // Visual audit: this specific VOD thumbnail advertises another series,
  // despite the replay's title saying '나들이'. Do not show misleading art.
  const mismatchedOutingFrame=String(payload.strictCrew||selected.strictCrew||'')==='장지수용소' &&
    /나들이/.test(activity) && /vod/i.test(String(selected.imageSource||'')) &&
    String(selected.imageUrl||'').includes('rowKey=20261004_1279B109_297581563_1_r');
  // A source image attached to the official, explicitly confirmed winner
  // announcement is relevant evidence even if no separate visual-review flag
  // was produced. Do NOT extend this exemption to an event promo or VOD.
  const originalPost=selectedPostFromPayload(payload);
  const originalHeading=String(originalPost&&originalPost.originalTitle||originalPost&&originalPost.title||'');
  const confirmedWinnerAnnouncement=/모카/.test(originalHeading) && /우승(?:을)?\s*축하/.test(originalHeading);
  const sourceImageMatches=Boolean(originalPost&&String(originalPost.imageUrl||'')&&String(originalPost.imageUrl||'')===String(selected.imageUrl||''));
  const winnerPostAttachedImage=Boolean(
    confirmedOutcomeForSelection(payload) && confirmedWinnerAnnouncement &&
    /^post_self(?:_verified)?$/.test(String(selected.imageSource||'')) && sourceImageMatches
  );
  const outcomeMedia=Boolean(confirmedOutcomeForSelection(payload)) && selected.imageVerifiedOutcome!==true && !winnerPostAttachedImage;
  const unverifiedEventImage=needsSpecificEventImageReview(payload);
  if (isSelectedEventPoster(payload)) {
    const reason='선택된 로블록스 합방 원문 게시글의 첨부 포스터';
    const changed=selected.imageSelectionReason!==reason || selected.imageRejected===true;
    selected.imageSelectionReason=reason;
    selected.imageRejected=false;
    return {payload:{...payload,selected},changed};
  }
  if (!(meetingVod||ambiguousEventVod||outcomeMedia||unverifiedEventImage||mismatchedOutingFrame) || !String(selected.imageUrl||'').trim()) return {payload,changed:false};
  selected.imageUrl='';
  selected.sheetImageUrl='';
  selected.imageSource='none';
  selected.imagePostId='';
  selected.imageRejected=true;
  selected.imageSelectionReason=mismatchedOutingFrame
    ? 'VOD 제목과 달리 썸네일은 다른 회차 홍보 장면으로 확인되어 제외' :
    meetingVod ? '점호·회의 단체 장면이 확인되지 않은 VOD 썸네일 제외'
    : ambiguousEventVod ? '복합 공지의 다중 이미지: 활동 대표 장면 미확인' :
      unverifiedEventImage ? '로블록스 방탈출 활동을 보여주는 이미지인지 미확인' : '우승 장면이 확인되지 않은 이미지 제외';
  return {payload:{...payload,selected},changed:true};
}

function applyFinalImageSafety(payload, options={}) {
  const safety=enforceEditorialImageSafety(payload);
  const sheet=ensureSheetImageUrl(safety.payload);
  if (!safety.changed && !sheet.changed) return payload;
  const blank=ensureBlankImageDirective(sheet.payload,options.blankUrl||DEFAULT_BLANK_SHEET_IMAGE_URL);
  // A display URL correction alone does not change the source fingerprint.
  // GAS still self-heals any missing local formula during its normal refresh.
  return refreshFingerprintState(blank.payload,options.stableFingerprint,safety.changed);
}
// Some legitimate SOOP images reach us without the separately prepared
// Google Sheets URL. Without one the GAS image-matches check treats an empty
// image cell as already correct. Only known HTTPS SOOP hosts may be proxied;
// never turn an arbitrary externally supplied URL into an image-fetch request.
function ensureSheetImageUrl(payload) {
  if (!payload || !payload.selected || payload.preservePrevious===true) return {payload,changed:false};
  const selected={...payload.selected};
  const imageUrl=String(selected.imageUrl||'').trim();
  if (!imageUrl || String(selected.sheetImageUrl||'').trim()) return {payload,changed:false};
  const proxy=require('../api/image.js')._internals;
  if (!proxy.allowed(imageUrl)) return {payload,changed:false};
  const normalized=proxy.normalizeImageUrl(imageUrl);
  selected.sheetImageUrl='https://crew-news-automation.vercel.app/api/image?url='+
    encodeURIComponent(normalized)+'&fit=sheet';
  return {payload:{...payload,selected},changed:true};
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
  const eventMedia=attachVerifiedEventMedia(titleResult.payload);
  const companion=attachVerifiedCompanionImage(eventMedia.payload);
  const safety=enforceEditorialImageSafety(companion.payload);
  const sheet=ensureSheetImageUrl(safety.payload);
  const imageResult=ensureBlankImageDirective(sheet.payload,options.blankUrl||DEFAULT_BLANK_SHEET_IMAGE_URL);
  const changed=titleResult.changed||eventMedia.changed||companion.changed||safety.changed||imageResult.changed;
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
  namedEventFromSelectedHeading,
  vrCollaborationFromSelectedPost,
  cleanGenericEventHeadline,
  corroboratedCrewGameActivity,
  namedTournamentOutcome,
  cleanSourceHeading,
  namedVrcContentActivity,
  namedCollaborationActivity,
  namedQualificationActivity,
  namedTournamentActivity,
  attachVerifiedEventMedia,
  needsSpecificEventImageReview,
  isSelectedEventPoster,
  confirmedOutcomeForSelection,
  enforceEditorialImageSafety,
  attachVerifiedCompanionImage,
  applyFinalImageSafety,
  inferSpecificActivity,
  refinedDisplayLabel,
  isGenericActivityLabel,
  applyEditorialTitle,
  ensureBlankImageDirective,
  ensureSheetImageUrl,
  selectedFingerprintInput,
  refreshFingerprintState,
  isIndividualExternalPromotionAuditPost,
  candidateAuditEntry,
  attachCandidateAudit,
  applyOutputPolicy
};