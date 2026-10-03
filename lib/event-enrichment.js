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
  if (pub && /내일/.test(source)) {
    const d = new Date(`${pub}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10);
  }
  if (pub && /어제/.test(source)) {
    const d = new Date(`${pub}T00:00:00Z`); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10);
  }
  return pub;
}

function isRetrospective(text='') {
  return /봐주신|봐주셔|감사합니다|고맙습니다|끝났|마쳤|마무리|후기|다녀왔|잘\s*봤/.test(String(text));
}

function detectSpecificActivity(text='') {
  const raw = String(text || '');
  if (/미스테리/i.test(raw)) return {activity:'미스테리', specificity:90};
  if (/놀숲/i.test(raw)) return {activity:/vrc/i.test(raw) ? 'VRC 놀숲' : '놀숲', specificity:95};
  if (/(?:피파|fc\s*온라인|fc온라인|엪온)/i.test(raw) && /\bck\b/i.test(raw)) return {activity:'피파 CK 합방', specificity:100};
  if (/vrc/i.test(raw) && /윷놀이/i.test(raw)) return {activity:'VRC 윷놀이', specificity:92};
  if (/메이드\s*카페/i.test(raw)) return {activity:'메이드카페', specificity:88};
  if (/점호/i.test(raw)) return {activity:'점호', specificity:86};
  if (/정기\s*회의/i.test(raw)) return {activity:'정기회의', specificity:80};
  if (/회의/i.test(raw)) return {activity:'회의', specificity:70};
  if (/합방/i.test(raw)) return {activity:'합방', specificity:45};
  if (/콘텐츠|컨텐츠/i.test(raw)) return {activity:'콘텐츠', specificity:30};
  return null;
}

function mentionsCrew(text, crew) {
  return normalize(text).includes(normalize(crew));
}

function descriptorForPost(post, crew, leaderStation='') {
  if (!post) return null;
  const title = String(post.originalTitle || post.title || '');
  const body = String(post.contents || '');
  const board = String(post.boardName || '');
  const combined = `${title}\n${body}`;
  const detected = detectSpecificActivity(combined);
  if (!detected) return null;
  const crewMention = mentionsCrew(combined, crew) || mentionsCrew(board, crew);
  const collectiveCue = /크루|크루원|친구들|멤버|같이|함께|합방|점호|회의|ck|콘텐츠|컨텐츠/i.test(combined);
  const official = isOfficialBoard(board);
  const leader = String(post.station || post.authorId || '') === String(leaderStation || '');
  if (!crewMention && !(leader && official && collectiveCue)) return null;
  if (isRetrospective(combined)) return null;
  const activityDate = resolveDate(combined, post.publishedAt || '');
  if (!activityDate) return null;
  const collaborator = /화양/i.test(combined) || String(post.station || post.authorId || '') === 'hwayang3' ? '화양' : '';
  return {
    ...post,
    station:String(post.station || post.authorId || ''),
    activity:detected.activity,
    specificity:detected.specificity,
    activityDate,
    official,
    leader,
    collaborator,
    imageUrl:String(post.imageUrl || ''),
    sheetImageUrl:String(post.sheetImageUrl || '')
  };
}

function activityFamily(activity='') {
  if (/피파 CK/.test(activity)) return 'fifa-ck';
  if (/미스테리/.test(activity)) return 'mystery';
  if (/놀숲/.test(activity)) return 'nolsup';
  if (/점호/.test(activity)) return 'roll-call';
  if (/윷놀이/.test(activity)) return 'yut';
  if (/회의/.test(activity)) return 'meeting';
  if (/메이드카페/.test(activity)) return 'maid';
  if (/합방|콘텐츠/.test(activity)) return 'generic';
  return normalize(activity);
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
  return {
    id:String(rep.id||''),
    station:String(rep.station||rep.authorId||''),
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
    imagePostId:rep.imageUrl ? String(rep.id||'') : '',
    imageSuitabilityScore:null,
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
  if (/메이드카페/.test(activity)) return /메이드\s*카페/i.test(title);
  if (/회의/.test(activity)) return /회의/i.test(title);
  return false;
}

function attachBestImage(event, posts=[], vods=[], leaderStation='') {
  if (!event) return event;
  if (event.imageUrl) return {...event};

  const clusterPosts=Array.isArray(event._clusterPosts) ? event._clusterPosts : [];
  const relatedPosts=clusterPosts.filter(p=>p.imageUrl && p.activityDate===event.activityDate);
  if (relatedPosts.length) {
    const p=relatedPosts[0];
    return {...event,imageUrl:p.imageUrl,sheetImageUrl:p.sheetImageUrl||p.imageUrl,imageSource:'post_member',imagePostId:String(p.id||'')};
  }

  const sameDateLeaderVods = (Array.isArray(vods)?vods:[])
    .filter(v=>String(v.station||'')===String(leaderStation||'') && parsePublishedDate(v.publishedAt)===event.activityDate && v.imageUrl && vodRelevantToEvent(event,v))
    .sort((a,b)=>Math.abs((Date.parse(String(a.publishedAt||'').replace(' ','T')+'Z')||0)-(Date.parse(String(event.sourcePublishedAt||'').replace(' ','T')+'Z')||0)) - Math.abs((Date.parse(String(b.publishedAt||'').replace(' ','T')+'Z')||0)-(Date.parse(String(event.sourcePublishedAt||'').replace(' ','T')+'Z')||0)));
  if (sameDateLeaderVods.length) {
    const v=sameDateLeaderVods[0];
    return {...event,imageUrl:v.imageUrl,sheetImageUrl:v.sheetImageUrl||v.imageUrl,imageSource:'leader_vod_same_day',imagePostId:'',fallbackVodUrl:v.vodUrl || (v.id?`https://vod.sooplive.com/player/${v.id}`:'')};
  }
  return {...event};
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
