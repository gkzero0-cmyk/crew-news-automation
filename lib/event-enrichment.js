'use strict';

const AUXILIARY_VALIDATORS = Object.freeze({
  '강씨세가': ['hwayang3']
});

const VERIFIED_EVENT_VODS = Object.freeze({
  '장지수용소|2026-09-28|점호': '208336221'
});

function normalize(value='') {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g,' ')
    .replace(/[\s\u200b\u00a0]+/g,'')
    .replace(/[\[\](){}<>「」『』“”'".,!?~·:;_\-|⭐✨🕹️🔔❁ᴗ͈ˬ⁾]+/g,'');
}

function isOfficialBoard(board='') {
  const compact = normalize(board);
  return /공지|공지사항|스케쥴|스케줄|일정|방송공지|오방공|크루/.test(compact);
}

function isRepresentativeImageUrl(url='') {
  const value=String(url||'').trim();
  if (!value) return false;
  return !/(?:\/images\/chat\/emoticon\/|\/emoticon\/|profile|avatar|favicon|channel_logo|bj_logo)/i.test(value);
}

function toIsoDate(year, month, day) {
  const d = new Date(Date.UTC(Number(year), Number(month)-1, Number(day)));
  if (d.getUTCFullYear() !== Number(year) || d.getUTCMonth()+1 !== Number(month) || d.getUTCDate() !== Number(day)) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function parsePublishedDate(publishedAt='') {
  const m = String(publishedAt).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function resolveDate(text='', publishedAt='') {
  const source = String(text || '');
  const pub = parsePublishedDate(publishedAt);
  const y = pub ? Number(pub.slice(0,4)) : new Date().getUTCFullYear();
  let m = source.match(/(?:^|[^\d])(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:[^\d]|$)/);
  if (m) return toIsoDate(m[1],m[2],m[3]);
  m = source.match(/(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?:[^\d]|$)/);
  if (m) return toIsoDate(y,m[1],m[2]);
  m = source.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m) return toIsoDate(y,m[1],m[2]);
  if (pub && /모레/.test(source)) {
    const d = new Date(`${pub}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate()+2);
    return d.toISOString().slice(0,10);
  }
  if (pub && /내일/.test(source)) {
    const d = new Date(`${pub}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate()+1);
    return d.toISOString().slice(0,10);
  }
  if (pub && /어제/.test(source)) {
    const d = new Date(`${pub}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate()-1);
    return d.toISOString().slice(0,10);
  }
  return pub;
}

function isRetrospective(text='') {
  return /봐주신|봐주셔|감사합니다|고맙습니다|끝났|마쳤|마무리|후기|다녀왔|잘\s*봤|(?:면접|합방|회의|콘텐츠|컨텐츠)?\s*(?:보고|하고)\s*왔/.test(String(text));
}

function detectSpecificActivity(text='') {
  const raw = String(text || '');
  if (/미스테리/i.test(raw)) return {activity:'미스테리', specificity:90};
  if (/놀숲/i.test(raw)) return {activity:/vrc/i.test(raw) ? 'VRC 놀숲' : '놀숲', specificity:95};
  if (/(?:피파|fc\s*온라인|fc온라인|엪온)/i.test(raw) && /\bck\b/i.test(raw)) return {activity:'피파 CK 합방', specificity:100};
  if (/vrc/i.test(raw) && /윷놀이/i.test(raw)) return {activity:'VRC 윷놀이', specificity:92};
  if (/vrc/i.test(raw) && /콘텐츠|컨텐츠/i.test(raw)) return {activity:'VRC 콘텐츠', specificity:88};
  if (/메이드\s*카페/i.test(raw)) return {activity:'메이드카페', specificity:88};
  if (/점호/i.test(raw)) return {activity:'점호', specificity:86};
  if (/정기\s*회의/i.test(raw)) return {activity:'정기회의', specificity:80};
  if (/면접/i.test(raw)) return {activity:'면접', specificity:76};
  if (/회의/i.test(raw)) return {activity:'회의', specificity:70};
  if (/합방/i.test(raw)) return {activity:'합방', specificity:45};
  if (/콘텐츠|컨텐츠/i.test(raw)) return {activity:'콘텐츠', specificity:30};
  return null;
}

function mentionsCrew(text, crew) {
  return normalize(text).includes(normalize(crew));
}

function activityFamily(activity='') {
  if (/피파 CK/.test(activity)) return 'fifa-ck';
  if (/미스테리/.test(activity)) return 'mystery';
  if (/놀숲/.test(activity)) return 'nolsup';
  if (/점호/.test(activity)) return 'roll-call';
  if (/윷놀이/.test(activity)) return 'yut';
  if (/VRC 콘텐츠/.test(activity)) return 'vrc-content';
  if (/면접/.test(activity)) return 'interview';
  if (/회의/.test(activity)) return 'meeting';
  if (/메이드카페/.test(activity)) return 'maid';
  if (/합방|콘텐츠/.test(activity)) return 'generic';
  return normalize(activity);
}

function activityEvidenceSegments(text='', detected=null) {
  if (!detected) return [];
  const family = activityFamily(detected.activity);
  return String(text || '')
    .split(/\n+/)
    .map(v=>v.trim())
    .filter(Boolean)
    .filter(segment=>{
      const rowDetected = detectSpecificActivity(segment);
      return rowDetected && activityFamily(rowDetected.activity) === family;
    });
}

function activityCrewEvidence(text='', detected=null, crew='') {
  if (!detected || !crew) return false;
  const family=activityFamily(detected.activity);
  const lines=String(text||'')
    .split(/\n+/)
    .map(v=>v.trim())
    .filter(Boolean);
  const separateScheduleRow=/(?:20\d{2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}|\d{1,2}\s*[./]\s*\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일)/;
  for (let index=0; index<lines.length; index+=1) {
    const rowDetected=detectSpecificActivity(lines[index]);
    if (!rowDetected) continue;
    const rowMatches = family==='generic'
      ? rowDetected.activity===detected.activity
      : activityFamily(rowDetected.activity)===family;
    if (!rowMatches) continue;
    if (mentionsCrew(lines[index],crew)) return true;
    for (const neighborIndex of [index-1,index+1]) {
      if (neighborIndex<0 || neighborIndex>=lines.length) continue;
      const neighbor=lines[neighborIndex];
      if (separateScheduleRow.test(neighbor)) continue;
      const neighborActivity=detectSpecificActivity(neighbor);
      if (neighborActivity) {
        const neighborMatches = family==='generic'
          ? neighborActivity.activity===detected.activity
          : activityFamily(neighborActivity.activity)===family;
        if (!neighborMatches) continue;
      }
      if (mentionsCrew(neighbor,crew)) return true;
    }
  }
  return false;
}

function activityDateEvidence(text='', detected=null) {
  if (!detected) return '';
  const family = activityFamily(detected.activity);
  const lines = String(text || '')
    .split(/\n+/)
    .map(v=>v.trim())
    .filter(Boolean);
  const dateCue = /(?:20\d{2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}|\d{1,2}\s*[./]\s*\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일|오늘|내일|모레|어제)/;
  const chunks=[];
  for (let index=0; index<lines.length; index+=1) {
    const rowDetected=detectSpecificActivity(lines[index]);
    if (!rowDetected || activityFamily(rowDetected.activity)!==family) continue;
    const activityLine=lines[index];
    if (dateCue.test(activityLine)) {
      chunks.push(activityLine);
      continue;
    }
    let precedingCue='';
    for (let cursor=index-1; cursor>=Math.max(0,index-3); cursor-=1) {
      if (dateCue.test(lines[cursor])) {
        precedingCue=lines[cursor];
        break;
      }
      const previousActivity=detectSpecificActivity(lines[cursor]);
      if (previousActivity && activityFamily(previousActivity.activity)!==family) break;
    }
    if (precedingCue) chunks.push(precedingCue);
    chunks.push(activityLine);
  }
  return [...new Set(chunks)].join('\n');
}

function descriptorForPost(post, crew, leaderStation='') {
  if (!post) return null;
  const title = String(post.originalTitle || post.title || '');
  const body = String(post.contents || '');
  const board = String(post.boardName || '');
  const stationOwnerId = String(post.station || '').trim();
  const postAuthorId = String(post.authorId || '').trim();
  if (stationOwnerId && postAuthorId && stationOwnerId !== postAuthorId) return null;
  const combined = `${title}\n${body}`;

  const explicitlyUnconfirmedPlan = /확정(?:은|된\s*건)?\s*(?:아니|아님|전)|미정|수정될\s*수|고민\s*중|기획\s*중|논의\s*중|검토\s*중|하자고\s*(?:남기|말하)|할지\s*고민|생각\s*중/i.test(combined);
  const laterExplicitConfirmation = /(?:최종\s*)?확정\s*(?:됐|되었|되었습니다|입니다|완료)|일정\s*확정|하기로\s*(?:확정|했|했습니다)/i.test(combined);
  const questionOnlyPost = /질문|문의|궁금/i.test(title) && !laterExplicitConfirmation;
  if (questionOnlyPost || (explicitlyUnconfirmedPlan && !laterExplicitConfirmation)) return null;

  const externalApplication = /(?:콘텐츠|컨텐츠|대회|합방|팀)[^.!?\n]{0,80}(?:지원(?:합니다|했|해|서|중)?|참가\s*신청|신청(?:합니다|했|해|서|중)?|지원서)|(?:지원(?:합니다|했|해|서|중)?|참가\s*신청|신청(?:합니다|했|해|서|중)?|지원서)[^.!?\n]{0,80}(?:콘텐츠|컨텐츠|대회|합방|팀)/i.test(combined);
  const participationConfirmed = /(?:최종\s*)?(?:선발|선정|합격)\s*(?:됐|되었|되었습니다|완료|확정|했|했습니다)|(?:참가|참여|출전)\s*(?:확정|합니다|해요|하게\s*됐|하게\s*되었습니다)/i.test(combined);
  const confirmationNegated = /(?:아직|미정|확정\s*[xX]|확정\s*아님|아닌|아니|여부|대기)[^.!?\n]{0,60}(?:선발|선정|합격|참가|참여|출전|확정)|(?:선발|선정|합격|참가|참여|출전|확정)[^.!?\n]{0,60}(?:아직|미정|[xX]|아님|아닌|아니|여부|대기)/i.test(combined);
  if (externalApplication && (!participationConfirmed || confirmationNegated)) return null;

  const personalCelebration = /(?:오리지널\s*(?:데뷔|아바타|모델)|새\s*(?:아바타|모델|의상)|신의상|리뉴얼\s*(?:아바타|모델))/i.test(combined) &&
    /축하|공개|출시|예쁘|데뷔/i.test(combined);
  if (personalCelebration) return null;

  const nonNewsMediaPost = /AI\s*게시판/i.test(board) &&
    /썸네일|다시보기|리플레이|하이라이트|클립|후기/i.test(combined);
  if (nonNewsMediaPost) return null;

  const detected = detectSpecificActivity(combined);
  if (!detected) return null;
  const evidenceSegments = activityEvidenceSegments(combined, detected);
  const evidenceText = evidenceSegments.length ? evidenceSegments.join('\n') : combined;
  const titleDetected = detectSpecificActivity(title);
  const titleCrewMention = mentionsCrew(title, crew);
  const boardCrewMention = mentionsCrew(board, crew);
  const crewMention = mentionsCrew(combined, crew) || boardCrewMention;
  const currentCrewActivityEvidence = activityCrewEvidence(combined, detected, crew);
  const collectiveCue = /크루|크루원|친구들|멤버|같이|함께|합방|점호|회의|면접|ck|콘텐츠|컨텐츠/i.test(evidenceText);
  const official = isOfficialBoard(board);
  const leader = String(post.authorId || post.station || '') === String(leaderStation || '');
  if (!crewMention && !(leader && official && collectiveCue)) return null;
  // A member's personal schedule or recap only represents the crew when the
  // detected activity itself, a bounded continuation line, its title, or a
  // dedicated crew board names the crew. Separately dated schedule rows are
  // never allowed to donate crew identity to another activity.
  if (!leader && !currentCrewActivityEvidence && !titleCrewMention && !boardCrewMention) return null;
  if (activityFamily(detected.activity) === 'generic' && !currentCrewActivityEvidence && !(leader && official && titleCrewMention)) return null;
  if (isRetrospective(combined)) return null;
  const dateEvidenceText = activityDateEvidence(combined, detected) || evidenceText;
  const activityDate = resolveDate(dateEvidenceText, post.publishedAt || '');
  if (!activityDate) return null;
  const collaborator = /화양/i.test(combined) || String(post.station || post.authorId || '') === 'hwayang3' ? '화양' : '';
  const rawImage=String(post.imageUrl||'');
  const imageUrl=isRepresentativeImageUrl(rawImage) ? rawImage : '';
  return {
    ...post,
    station:String(post.station || post.authorId || ''),
    activity:detected.activity,
    specificity:detected.specificity,
    activityDate,
    official,
    leader,
    collaborator,
    titleActivityExplicit:Boolean(titleDetected),
    titleCrewMention,
    imageUrl,
    sheetImageUrl:imageUrl ? String(post.sheetImageUrl || '') : ''
  };
}

function chooseWinningDescriptors(rows) {
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.activityDate)) byDate.set(row.activityDate, []);
    byDate.get(row.activityDate).push(row);
  }
  const dates = [...byDate.keys()].sort().reverse();
  for (const date of dates) {
    const sameDate = byDate.get(date);
    const specific = sameDate.filter(r => activityFamily(r.activity) !== 'generic');
    const pool = specific.length ? specific : sameDate;
    const groups = new Map();
    for (const row of pool) {
      const key = activityFamily(row.activity);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const ranked = [...groups.values()].sort((a,b) => {
      const aScore = a.length*100 + Math.max(...a.map(r=>r.specificity||0));
      const bScore = b.length*100 + Math.max(...b.map(r=>r.specificity||0));
      if (bScore !== aScore) return bScore-aScore;
      const aLatest = Math.max(...a.map(r=>Date.parse(String(r.publishedAt||'').replace(' ','T')+'Z')||0));
      const bLatest = Math.max(...b.map(r=>Date.parse(String(r.publishedAt||'').replace(' ','T')+'Z')||0));
      return bLatest-aLatest;
    });
    if (ranked.length) return {date, rows:ranked[0], allSameDate:sameDate};
  }
  return null;
}

function representativeScore(row, leaderStation='') {
  let score = Number(row.specificity || 0)*10;
  if (row.imageUrl) score += 80;
  if (row.official) score += 25;
  if (row.titleActivityExplicit) score += 30;
  if (row.titleCrewMention) score += 15;
  if (String(row.station||'') === String(leaderStation||'')) score += 15;
  if (row.collaborator) score += 10;
  const time = Date.parse(String(row.publishedAt||'').replace(' ','T')+'Z') || 0;
  return score + time/1e12;
}

function makeDisplaySummary(crew, activity, rows) {
  let summary = `${crew} ${activity}`.replace(/\s+/g,' ').trim();
  if (activity === '미스테리' && rows.some(r=>r.collaborator === '화양')) summary += ' w. 화양';
  return summary;
}

function uniqueEvidenceStations(rows=[]) {
  return [...new Set((Array.isArray(rows)?rows:[])
    .map(row=>String(row&&row.station||row&&row.authorId||'').trim())
    .filter(Boolean))];
}

function uniqueEvidenceAuthors(rows=[]) {
  return [...new Set((Array.isArray(rows)?rows:[])
    .map(row=>String(row&&row.author||row&&row.station||row&&row.authorId||'').trim())
    .filter(Boolean))];
}

function selectionReasonFor(rep, rows=[], leaderStation='') {
  const stations=uniqueEvidenceStations(rows);
  if (rep && rep.leader && rep.official) return '크루장 공식공지';
  if (stations.length >= 2) return '크루원 다수 일치';
  if (rep && rep.titleCrewMention && rep.titleActivityExplicit) return '제목 직접일치';
  if (rep && rep.official) return '공식 공지 문맥';
  if (rep && String(rep.station||'') === String(leaderStation||'')) return '크루장 활동 문맥';
  return '크루 활동 문맥 일치';
}

function synthesizeCrewEvent(posts=[], crew='', leaderStation='') {
  const rows = (Array.isArray(posts)?posts:[])
    .map(post=>descriptorForPost(post,crew,leaderStation))
    .filter(Boolean);
  if (!rows.length) return null;
  const winning = chooseWinningDescriptors(rows);
  if (!winning) return null;
  const members = winning.rows.slice().sort((a,b)=>representativeScore(b,leaderStation)-representativeScore(a,leaderStation));
  const rep = members[0];
  const activity = members.slice().sort((a,b)=>(b.specificity||0)-(a.specificity||0))[0].activity;
  const displaySummary = makeDisplaySummary(crew,activity,winning.rows);
  const evidenceStations=uniqueEvidenceStations(winning.rows);
  const evidenceAuthors=uniqueEvidenceAuthors(winning.rows);
  return {
    id:String(rep.id||''),
    station:String(rep.station||rep.authorId||''),
    author:String(rep.author||''),
    postUrl:String(rep.postUrl || (rep.id && rep.station ? `https://www.sooplive.com/station/${rep.station}/post/${rep.id}` : '')),
    summary:activity,
    displaySummary,
    activity,
    specificity:Math.max(...winning.rows.map(r=>Number(r.specificity||0))),
    activityDate:winning.date,
    activityDateSource:'event-cluster',
    publishedAt:String(rep.publishedAt||''),
    sourcePublishedAt:String(rep.publishedAt||''),
    imageUrl:String(rep.imageUrl||''),
    sheetImageUrl:String(rep.sheetImageUrl||''),
    imageSource:rep.imageUrl ? 'post_self' : 'none',
    imageSelectionReason:rep.imageUrl ? '대표 게시글 이미지' : '적합 이미지 없음',
    imagePostId:rep.imageUrl ? String(rep.id||'') : '',
    imageSuitabilityScore:null,
    selectionReason:selectionReasonFor(rep,winning.rows,leaderStation),
    evidenceCount:evidenceStations.length,
    evidenceStations,
    evidenceAuthors,
    representativeTier:rep.leader ? 1 : 2,
    isCrewLeader:Boolean(rep.leader),
    extractionQuality:8,
    extractionComplete:true,
    _clusterPosts:winning.rows
  };
}

function vodRelevantToEvent(event, vod) {
  if (!event || !vod) return false;
  if (vod.verifiedEventMedia === true) return true;
  const title=String(vod.title||'');
  const activity=String(event.activity||'');
  if (/미스테리/.test(activity)) return /미스테리/i.test(title);
  if (/놀숲/.test(activity)) return /놀숲|vrc/i.test(title);
  if (/피파 CK/.test(activity)) return /(?:피파|fc\s*온라인|fc온라인|엪온)/i.test(title) && /\bck\b/i.test(title);
  if (/점호/.test(activity)) return /점호|월말\s*결산/i.test(title);
  if (/윷놀이/.test(activity)) return /윷놀이/i.test(title);
  if (/VRC 콘텐츠/.test(activity)) return /vrc/i.test(title);
  if (/메이드카페/.test(activity)) return /메이드\s*카페/i.test(title);
  if (/회의/.test(activity)) return /회의/i.test(title);
  return false;
}

function attachBestImage(event, posts=[], vods=[], leaderStation='') {
  if (!event) return event;
  if (event.imageUrl) return {...event,imageSelectionReason:event.imageSelectionReason||'대표 게시글 이미지'};
  const clusterPosts=Array.isArray(event._clusterPosts) ? event._clusterPosts : [];
  const relatedPosts=clusterPosts.filter(p=>p.imageUrl && p.activityDate===event.activityDate && isRepresentativeImageUrl(p.imageUrl));
  if (relatedPosts.length) {
    const p=relatedPosts[0];
    return {...event,imageUrl:p.imageUrl,sheetImageUrl:p.sheetImageUrl||p.imageUrl,imageSource:'post_member',imageSelectionReason:'같은 이벤트 크루원 이미지',imagePostId:String(p.id||'')};
  }
  const sameDateLeaderVods = (Array.isArray(vods)?vods:[])
    .filter(v=>String(v.station||'')===String(leaderStation||'') && parsePublishedDate(v.publishedAt)===event.activityDate && v.imageUrl && isRepresentativeImageUrl(v.imageUrl) && vodRelevantToEvent(event,v))
    .sort((a,b)=>Math.abs((Date.parse(String(a.publishedAt||'').replace(' ','T')+'Z')||0)-(Date.parse(String(event.sourcePublishedAt||'').replace(' ','T')+'Z')||0)) - Math.abs((Date.parse(String(b.publishedAt||'').replace(' ','T')+'Z')||0)-(Date.parse(String(event.sourcePublishedAt||'').replace(' ','T')+'Z')||0)));
  if (sameDateLeaderVods.length) {
    const v=sameDateLeaderVods[0];
    return {...event,imageUrl:v.imageUrl,sheetImageUrl:v.sheetImageUrl||v.imageUrl,imageSource:'leader_vod_same_day',imageSelectionReason:'같은 날짜 크루장 VOD',imagePostId:'',fallbackVodUrl:v.vodUrl || (v.id?`https://vod.sooplive.com/player/${v.id}`:'')};
  }
  return {...event,imageSelectionReason:event.imageSelectionReason||'적합 이미지 없음'};
}

function verifiedVodIdFor(crew,event) {
  if (!event) return '';
  return VERIFIED_EVENT_VODS[`${crew}|${event.activityDate}|${event.activity}`] || '';
}

function shouldReplaceCore(coreSelected, event) {
  if (!event) return false;
  if (!coreSelected) return true;
  const coreDate=String(coreSelected.activityDate||coreSelected.publishedAt||'').slice(0,10);
  if (!coreDate) return true;
  if (event.activityDate > coreDate) return true;
  if (event.activityDate < coreDate) return false;
  const genericCore=/(?:콘텐츠|합방|일정)/.test(String(coreSelected.displaySummary||coreSelected.summary||''));
  return genericCore && event.specificity >= 70;
}

function needsEnrichment(coreSelected) {
  if (!coreSelected) return true;
  if (!coreSelected.imageUrl) return true;
  if (/(?:콘텐츠|합방|일정)/.test(String(coreSelected.displaySummary||coreSelected.summary||''))) return true;
  const date=String(coreSelected.activityDate||'').slice(0,10);
  if (!date) return true;
  return (Date.now() - Date.parse(`${date}T00:00:00Z`)) > 3*24*60*60*1000;
}

module.exports={
  AUXILIARY_VALIDATORS,
  VERIFIED_EVENT_VODS,
  normalize,
  isOfficialBoard,
  isRepresentativeImageUrl,
  resolveDate,
  detectSpecificActivity,
  descriptorForPost,
  synthesizeCrewEvent,
  vodRelevantToEvent,
  attachBestImage,
  verifiedVodIdFor,
  shouldReplaceCore,
  needsEnrichment,
  parsePublishedDate
};
