'use strict';

const crewNewsHandler=require('./crew-news.js');
const crewNewsInternals=crewNewsHandler._internals || {};
const {POLICY_VERSION}=require('../lib/version.js');

const CREW_BY_LEADER = Object.freeze({
  yjkim5500: '조적단',
  rkdakstlr911: '강씨세가',
  jangjh5409: '진드기',
  '243000': '천타버스',
  zzamta0310: 'ZZAM지트',
  iamquaddurup: '장지수용소',
  beemong: '머리퍼리',
  dstv: '자라섬'
});

const LEADER_BY_CREW = Object.freeze(
  Object.fromEntries(Object.entries(CREW_BY_LEADER).map(([station, crew]) => [crew, station]))
);

const MANUAL_SUMMARY = Object.freeze({
  '조적단': { '207589893': '배그 킬내기 일정 조율' },
  '장지수용소': { '207422623': '러닝' },
  '강씨세가': { '207358053': '1주년' },
  '진드기': { '207893749': '히어로 레드 웰컴 진드기' },
  'ZZAM지트': { '207641333': '소울체인드 합방' },
  '자라섬': { '208189099': 'VRC 윷놀이' },
  '천타버스': { '208075141': '천타버스 추석특집' }
});

const MANUAL_DISPLAY_SUMMARY = Object.freeze({
  '조적단': { '207589893': '배그 킬내기 일정 조율' },
  '진드기': { '207893749': '히어로 레드 웰컴 진드기' },
  'ZZAM지트': { '207641333': '소울체인드 합방' },
  '자라섬': { '208189099': 'VRC 윷놀이' },
  '천타버스': { '208075141': '천타버스 추석특집' }
});

// 동일한 크루 활동을 여러 멤버가 공통 공지한 경우, 내용 정확성이 같은 후보 중
// 크루 전체를 가장 잘 보여주는 대표 이미지가 확인된 게시글을 우선한다.
const REPRESENTATIVE_MEDIA_PRIORITY = Object.freeze({
  '자라섬': { '208189099': 1 },
  '천타버스': { '208075141': 100 }
});

// Verified VODs may receive a small tie-break boost after the generic
// same-date/same-activity checks. This is never enough to bypass relevance.
const VERIFIED_VOD_MEDIA_PRIORITY = Object.freeze({
  '머리퍼리': { '208370567': 24 }
});

// A post image can be explicitly rejected later without disabling the news item.
// Generic relevance checks still run for every crew.
const REJECT_POST_IMAGE_IDS = new Set([]);

// User-verified VOD thumbnails that are semantically related but visually poor
// representatives of the crew news. They are skipped and the search continues;
// if no better relevant thumbnail exists the image remains blank.
const REJECT_VOD_MEDIA_IDS = new Set([
  '207422027' // 강씨세가 1주년: dark/personal gameplay-style thumbnail
]);

// 여러 크루원이 같은 일정을 공지해 상대 날짜/기간 표현만 남은 경우의 검증된 실제 시작일.
// 기간(예: 3박 4일, 3~4일)은 날짜로 해석하지 않는다.
const MANUAL_ACTIVITY_DATE = Object.freeze({
  '진드기': {
    '208412493': '2026-09-30',
    '208395133': '2026-09-30',
    '208704035': '2026-09-30'
  }
});

const EXTRA_SEARCHES = Object.freeze({
  'ZZAM지트': [{ station: 'zzamta0310', keyword: '소울' }]
});

const FALLBACK_REPRESENTATIVE = Object.freeze({
  'ZZAM지트': {
    id: '207641333',
    station: 'zzamta0310',
    title: '\u200B소울체인드 합방',
    originalTitle: '엘밤통? 그거보다 더심한 소울류가 온다...!',
    author: '짬타수아XV',
    authorId: 'zzamta0310',
    publishedAt: '2026-09-20 18:51:05',
    bbsNo: '99850883',
    boardName: '스케쥴 게시판',
    accessType: 'public',
    postUrl: 'https://www.sooplive.com/station/zzamta0310/post/207641333',
    imageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/5/26840115/61411789897829858.png',
    sheetImageUrl: 'https://stimg.sooplive.com/NORMAL_BBS/5/26840115/61411789897829858.png',
    hashtags: [],
    contents: 'ZZAM지트 소울체인드 합방\n체인투게더+다크소울\n\n오늘밤8시',
    strictCrew: 'ZZAM지트',
    strictActivity: '소울체인드 합방',
    displaySummary: '소울체인드 합방',
    strictPriority: 1,
    representativeTier: 1,
    isCrewLeader: true,
    isLeaderRepresentative: true,
    fallbackRepresentative: true
  }
});

const EXCLUDED_BOARD_RE = /자유|잡담|일상|이벤트|event|팬\s*게시판|애청자|이봤/i;
const NOTICE_BOARD_RE = /공지|공지사항/i;
const OFFICIAL_BOARD_RE = /공지|공지사항|스케쥴|스케줄|일정|방송알림|크루/i;
const COLLECTIVE_RE = /크루|크루원|멤버|친구들|전체|다\s*모|1\s*,?\s*2\s*기|함께|같이|with|합방|회의|점호|회식|여행|러닝|1주년|창단|모집|면접|영입|합격|사냥\s*대결|대결|대항전|\bvs\.?\b|매치/i;

function safeStations(raw = '') {
  const seen = new Set();
  const stations = [];
  for (const value of String(raw || '').split(',')) {
    const station = value.trim();
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(station) || seen.has(station)) continue;
    seen.add(station);
    stations.push(station);
    if (stations.length >= 20) break;
  }
  return stations;
}

function intParam(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\s\u200b\u00a0]+/g, '')
    .replace(/[\[\](){}<>「」『』“”'".,!?~·:;_\-]/g, '');
}

function inferCrew(stations) {
  for (const station of stations) {
    if (CREW_BY_LEADER[station]) return CREW_BY_LEADER[station];
  }
  return '';
}

function detectActivity(raw = '') {
  const text = String(raw || '').replace(/\s+/g, ' ');
  const tests = [
    [/1\s*주년/i, '1주년'],
    [/러닝|달리기/i, '러닝'],
    [/soul\s*chained|소울\s*체인드|체인투게더\s*\+?\s*다크소울/i, '소울체인드 합방'],
    [/정기\s*회의/i, '정기회의'],
    [/비방\s*회의/i, '비방회의'],
    [/회의/i, '회의'],
    [/중계\s*합방/i, '중계합방'],
    [/종겜\s*합방/i, '종겜합방'],
    [/모캡/i, '모캡 합방'],
    [/메이드\s*카페/i, '메이드카페'],
    [/점호/i, '점호'],
    [/합방/i, '합방'],
    [/세미\s*사주|세미사주/i, '세미사주'],
    [/모집/i, '모집'],
    [/면접/i, '면접'],
    [/웰컴|welcome/i, '영입'],
    [/영입/i, '영입'],
    [/신규\s*멤버|신입\s*멤버/i, '신규 멤버'],
    [/합격/i, '합격'],
    [/가입/i, '가입'],
    [/탈퇴/i, '탈퇴'],
    [/창단/i, '창단'],
    [/회식/i, '회식'],
    [/여행|엠티|\bMT\b/i, '여행'],
    [/모임/i, '모임'],
    [/행사/i, '행사'],
    [/사냥\s*대결|더\s*헌터[^\n]*(?:대결|\bvs\b)|(?:곰\s*)?사냥[^\n]*(?:대결|\bvs\b)/i, '사냥대결'],
    [/\bvs\.?\b|대결|대항전|매치/i, '대결'],
    [/대회/i, '대회'],
    [/vrc\s*윷놀이|윷놀이/i, 'VRC 윷놀이'],
    [/콘텐츠|컨텐츠/i, '콘텐츠'],
    [/일정/i, '일정']
  ];
  for (const [re, label] of tests) {
    if (re.test(text)) return label;
  }
  return '';
}

function isRetrospectiveActivityPost(raw = '') {
  const text = String(raw || '').replace(/\s+/g, ' ');
  const completionCue = /(?:한국\s*도착|집에?\s*(?:갑|가|왔|도착)|다녀왔|여행(?:이|은|을)?[^.!?\n]{0,40}(?:끝|마무리|오랜만|좋았|즐거웠))/i;
  const followupCue = /(?:오늘|내일|모레)?[^.!?\n]{0,30}(?:후기|썰|리뷰)(?:\s*(?:뱅|방송))?/i;
  const explicitTravelReview = /(?:여행|엠티|\bMT\b)[^.!?\n]{0,40}(?:후기|썰|리뷰)|(?:후기|썰|리뷰)[^.!?\n]{0,30}(?:여행|엠티|\bMT\b)/i;
  const futureTripCue = /(?:내일부터|모레부터|오늘부터|여행\s*(?:갑니다|가요|예정|시작)|(?:여행|엠티)[^.!?\n]{0,30}(?:출발|가게\s*되))/i;
  return followupCue.test(text) && (
    completionCue.test(text) ||
    (explicitTravelReview.test(text) && !futureTripCue.test(text))
  );
}

function deriveCompetitiveDisplaySummary(sourceTitle = '', crew = '', activity = '') {
  if (!/(?:사냥\s*대결|대결|대항전|\bvs\.?\b|매치)/i.test(String(activity) + ' ' + String(sourceTitle))) return '';

  let text = String(sourceTitle || '').replace(/\s+/g, ' ').trim();

  // Remove only leading schedule metadata. Keep crew/opponent/game/activity wording intact.
  text = text.replace(
    /^\s*(?:(?:20\d{2})\s*[./-]\s*)?\d{1,2}\s*[./-]\s*\d{1,2}\s*(?:(?:월|화|수|목|금|토|일)(?:요일)?\s*)?/i,
    ''
  );
  text = text.replace(
    /^\s*(?:(?:오전|오후)\s*)?\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*/i,
    ''
  );
  text = text.replace(/\s+vs\.?\s+/ig, ' VS ').replace(/\s+/g, ' ').trim();

  const crewToken = normalize(crew);
  if (!text || !normalize(text).includes(crewToken)) return '';
  return text;
}

function sameRepresentativeActivity(a, b) {
  if (!a || !b) return false;
  const aRawActivity = String(a.strictActivity || a.displaySummary || '');
  const bRawActivity = String(b.strictActivity || b.displaySummary || '');
  const aActivity = normalize(aRawActivity);
  const bActivity = normalize(bRawActivity);
  if (!aActivity || !bActivity) return false;

  const aDate = String(a.activityDate || '').slice(0,10);
  const bDate = String(b.activityDate || '').slice(0,10);
  const sameDate = !aDate || !bDate || aDate === bDate;
  if (!sameDate) return false;
  if (aActivity === bActivity) return true;

  // Broader equivalence is only safe when both candidates have a concrete
  // matching date. It prevents a later generic member description from
  // replacing the stronger representative of the same crew event.
  if (!aDate || !bDate) return false;

  const aFamily = activityFamily(aRawActivity);
  const bFamily = activityFamily(bRawActivity);
  if (aFamily && aFamily === bFamily && aFamily === 'contest') return true;

  const genericPair = new Set([aActivity, bActivity]);
  if (genericPair.size === 2 && genericPair.has('콘텐츠') && genericPair.has('합방')) return true;

  return false;
}

function compareRepresentativeCandidates(a, b) {
  const sameActivity = sameRepresentativeActivity(a, b);

  // Different crew activities are ordered by freshness first. A leader post
  // is only a representative-quality advantage, not permission to pin an
  // older event above a newer confirmed activity from another member.
  if (!sameActivity) {
    const time =
      parseTime(b.sourcePublishedAt || b.publishedAt) -
      parseTime(a.sourcePublishedAt || a.publishedAt);
    if (time) return time;

    const tier = Number(a.representativeTier || 9) - Number(b.representativeTier || 9);
    if (tier) return tier;

    return Number(Boolean(b.isCrewLeader)) - Number(Boolean(a.isCrewLeader));
  }

  // Inside the same activity/date, keep the existing representative-quality
  // preference so the best crew-wide post/image remains the chosen source.
  const tier = Number(a.representativeTier || 9) - Number(b.representativeTier || 9);
  if (tier) return tier;

  const mediaPriority =
    Number(b.representativeMediaPriority || 0) -
    Number(a.representativeMediaPriority || 0);
  if (mediaPriority) return mediaPriority;

  const sameContinuousEvent = Boolean(
    a.continuousEventStartDate &&
    a.continuousEventStartDate === b.continuousEventStartDate
  );
  if (sameContinuousEvent) {
    const aAnchor=String(a.observedActivityDate||a.activityDate||'').slice(0,10)===a.continuousEventStartDate;
    const bAnchor=String(b.observedActivityDate||b.activityDate||'').slice(0,10)===b.continuousEventStartDate;
    if (aAnchor!==bAnchor) return Number(bAnchor)-Number(aAnchor);
  }

  const time =
    parseTime(b.sourcePublishedAt || b.publishedAt) -
    parseTime(a.sourcePublishedAt || a.publishedAt);
  if (time) return time;

  return Number(Boolean(b.isCrewLeader)) - Number(Boolean(a.isCrewLeader));
}

function parseTime(value = '') {
  const t = Date.parse(String(value || '').replace(' ', 'T') + '+09:00');
  return Number.isFinite(t) ? t : 0;
}

function formatKstDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const pick = type => parts.find(part => part.type === type)?.value || '';
  return pick('year') + '-' + pick('month') + '-' + pick('day');
}

function resolveActivityDateInfo(raw = '', publishedAt = '') {
  const text = String(raw || '').replace(/\s+/g, ' ');
  const baseMs = parseTime(publishedAt);
  if (!baseMs) return {date:'',source:'none'};

  const baseDate = formatKstDate(new Date(baseMs));
  const baseYear = Number(baseDate.slice(0,4));

  function validDate(year, month, day) {
    const candidate = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) return '';
    return formatKstDate(candidate);
  }

  function nearestYear(month, day) {
    const baseAt = Date.parse(baseDate + 'T00:00:00+09:00');
    const candidates = [baseYear - 1, baseYear, baseYear + 1]
      .map(year => ({year,date:validDate(year,month,day)}))
      .filter(row => row.date)
      .map(row => ({
        ...row,
        distance:Math.abs(Date.parse(row.date + 'T00:00:00+09:00') - baseAt)
      }))
      .sort((a,b)=>a.distance-b.distance);
    return candidates[0] || null;
  }

  let match = text.match(/(?:^|[^0-9])(20\d{2})[-/.](1[0-2]|0?[1-9])[-/.](3[01]|[12]?\d)(?=$|[^0-9])/);
  if (match) {
    const date = validDate(Number(match[1]),Number(match[2]),Number(match[3]));
    if (date) return {date,source:'explicit-iso'};
  }

  match = text.match(/(?:(20\d{2})\s*년\s*)?(1[0-2]|0?[1-9])\s*월\s*(3[01]|[12]?\d)\s*일(?:부터|에|날)?/);
  if (match) {
    const row = match[1]
      ? {year:Number(match[1]),date:validDate(Number(match[1]),Number(match[2]),Number(match[3]))}
      : nearestYear(Number(match[2]),Number(match[3]));
    if (row && row.date) return {date:row.date,source:'explicit-korean'};
  }

  const compactRe = /(?:^|[^0-9])(1[0-2]|0?[1-9])([/.])(3[01]|[12]?\d)(?=$|[^0-9])/g;
  while ((match = compactRe.exec(text))) {
    const month=Number(match[1]);
    const day=Number(match[3]);
    const around=text.slice(Math.max(0,match.index-14),Math.min(text.length,match.index+match[0].length+18));
    if (/\d+\s*박|\d+\s*일간|\d+\s*승|\d+\s*패|세트|스코어|분의|\d+\s*명|\d+\s*개|\d+\s*킬/i.test(around)) continue;
    const row=nearestYear(month,day);
    if (row && row.date) {
      return {date:row.date,source:match[2] === '.' ? 'explicit-dot' : 'explicit-slash'};
    }
  }

  const relative = /모레/.test(text) ? 2 : /내일/.test(text) ? 1 : /오늘/.test(text) ? 0 : null;
  if (relative !== null) {
    const [y,m,d] = baseDate.split('-').map(Number);
    return {
      date:formatKstDate(new Date(Date.UTC(y,m-1,d+relative,3,0,0))),
      source:'relative'
    };
  }
  return {date:'',source:'none'};
}

function resolveActivityDate(raw = '', publishedAt = '') {
  return resolveActivityDateInfo(raw,publishedAt).date;
}

function parseActivityDurationDays(raw = '') {
  const text=String(raw||'').replace(/\s+/g,' ');
  let match=text.match(/(\d{1,2})\s*박\s*(\d{1,2})\s*일/);
  if (match) {
    const days=Number(match[2]);
    return days>=2 && days<=14 ? days : 0;
  }
  match=text.match(/(?:^|[^\d])(\d{1,2})\s*일(?:간|동안)(?:[^\d]|$)/);
  if (match) {
    const days=Number(match[1]);
    return days>=2 && days<=14 ? days : 0;
  }
  return 0;
}

function addIsoDays(dateOnly, offset) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOnly||''))) return '';
  const date=new Date(String(dateOnly)+'T00:00:00Z');
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate()+Number(offset||0));
  return date.toISOString().slice(0,10);
}

function activityPublishedAt(dateOnly, publishedAt) {
  if (!dateOnly) return publishedAt;
  const time = String(publishedAt || '').match(/\b(\d{2}:\d{2}:\d{2})\b/);
  return dateOnly + ' ' + (time ? time[1] : '12:00:00');
}

function postExtractionQuality(post) {
  const body = String(post?.contents || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const title = String(post?.originalTitle || post?.title || '').trim();
  let score = 0;
  if (title.length >= 2) score += 2;
  if (body.length >= 12) score += 3;
  if (post?.boardName) score += 1;
  if (post?.author || post?.authorId) score += 1;
  if (post?.publishedAt) score += 1;
  return {score, bodyLength: body.length, complete: score >= 6};
}

function strictCrewPost(post, crew, station) {
  if (!post || !crew) return null;
  const title = String(post.title || '');
  const sourceTitle = String(post.originalTitle || post.title || '');
  const body = String(post.contents || '');
  const board = String(post.boardName || '');
  const accessType = String(post.accessType || '');
  const id = String(post.id || '');
  const extraction = postExtractionQuality(post);

  if (accessType === 'favorite' || EXCLUDED_BOARD_RE.test(board)) return null;

  const crewToken = normalize(crew);
  const titleCrew = normalize(title).includes(crewToken);
  const bodyCrew = normalize(body).includes(crewToken);
  const boardCrew = normalize(board).includes(crewToken);
  const notice = NOTICE_BOARD_RE.test(board);
  const officialBoard = OFFICIAL_BOARD_RE.test(board);
  const leader = station === LEADER_BY_CREW[crew];
  const override = MANUAL_SUMMARY[crew] && MANUAL_SUMMARY[crew][id] || '';
  if (!override && /방셀|당첨자|당첨\s*안내|보상|경품|상품|배송|배달|전달\s*완료|수령|정산/i.test(sourceTitle)) return null;

  const activityText = sourceTitle + '\n' + body;
  const detectedActivity = detectActivity(activityText);
  const conditionalOrAspirational = /(?:하고\s*싶|가고\s*싶|해보고\s*싶|되면|된다면|성공하면|달성하면|목표\s*달성|공약|도와\s*달|도와주|부탁|희망|바라|예정\s*희망)/i.test(activityText);
  const confirmedSchedule = /(?:확정|진행(?:합니다|해요|예정|하기로)?|참여(?:합니다|해요|예정)?|합방(?:합니다|해요|예정)?|회의(?:합니다|해요|예정)?|여행(?:갑니다|가요|예정)?|할\s*예정|하기로|일정(?:은|이|:)?|오늘|내일|모레|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}[\/.]\d{1,2})/i.test(activityText);
  const downstreamOnly = /(?:후기|결과|정산|당첨|상품|경품|배송|수령|보상|감사합니다|잘\s*다녀왔)/i.test(activityText) && !confirmedSchedule;
  const retrospectiveOnly = detectedActivity === '여행' && isRetrospectiveActivityPost(activityText);
  const contextualActivity = (conditionalOrAspirational && !confirmedSchedule) || downstreamOnly || retrospectiveOnly ? '' : detectedActivity;
  const activity = override || contextualActivity || (leader && boardCrew && /특집/i.test(sourceTitle) ? '추석특집' : '');

  if (!activity) return null;

  const activityDurationDays = activityFamily(activity) === 'travel'
    ? parseActivityDurationDays(activityText)
    : 0;

  const direct = (titleCrew || boardCrew) && Boolean(activity);
  const noticeRelated = notice && (titleCrew || bodyCrew || boardCrew) && Boolean(activity);
  const leaderRepresentative = leader && officialBoard && (
    Boolean(override) ||
    ((titleCrew || bodyCrew || boardCrew) && COLLECTIVE_RE.test(sourceTitle + '\n' + body))
  );
  const officialMemberTravel = !leader &&
    officialBoard &&
    bodyCrew &&
    activityFamily(activity) === 'travel' &&
    confirmedSchedule &&
    COLLECTIVE_RE.test(activityText) &&
    (
      activityDurationDays >= 2 ||
      /(?:단체|크루|멤버)[^.!?\n]{0,30}(?:여행|엠티|\bMT\b)|(?:여행|엠티|\bMT\b)[^.!?\n]{0,30}(?:중|갑니다|가요|가게\s*되|출발)/i.test(activityText)
    );

  if (!leaderRepresentative && !officialMemberTravel && !direct && !noticeRelated) return null;

  const representativeTier = leaderRepresentative ? 1 : 2;
  const competitiveSummary = override ? '' : deriveCompetitiveDisplaySummary(sourceTitle, crew, activity);
  const summary = override || competitiveSummary || activity;
  const manualDisplay = MANUAL_DISPLAY_SUMMARY[crew] && MANUAL_DISPLAY_SUMMARY[crew][id] || '';
  const displaySummary = manualDisplay || (normalize(summary).includes(crewToken) ? summary : crew + ' ' + summary);
  // Apps Script v4는 후보 허용 판정에서 제목/게시판에 크루명이 있어야 한다.
  // 모든 후보 제목을 "크루명 + 표시 요약"으로 전달하고 Apps Script가 첫 크루명만 제거하게 한다.
  // 이렇게 하면 후보 판정은 통과하면서 zero-width 문자를 전혀 쓰지 않는다.
  const compatibilityTitle = crew + ' ' + displaySummary;
  const manualActivityDate = MANUAL_ACTIVITY_DATE[crew] && MANUAL_ACTIVITY_DATE[crew][id] || '';
  const parsedActivity = resolveActivityDateInfo(sourceTitle + '\n' + body, post.publishedAt);
  const parsedActivityDate = parsedActivity.date;
  const resolvedActivityDate = manualActivityDate || parsedActivityDate;
  const activityDateSource = manualActivityDate
    ? 'manual'
    : (parsedActivityDate ? parsedActivity.source : 'published');
  const eventPublishedAt = (crew === '천타버스' && id === '208075141')
    ? '2026-09-26 18:00:00'
    : activityPublishedAt(resolvedActivityDate, post.publishedAt);

  return {
    ...post,
    originalTitle: sourceTitle,
    title: compatibilityTitle,
    publishedAt: eventPublishedAt,
    sourcePublishedAt: post.publishedAt,
    activityDate: resolvedActivityDate || String(post.publishedAt || '').slice(0, 10),
    activityDateSource,
    contents: crew + ' ' + summary + '\n' + body,
    strictCrew: crew,
    strictActivity: summary,
    displaySummary,
    strictPriority: representativeTier,
    representativeTier,
    isCrewLeader: leader,
    isLeaderRepresentative: leaderRepresentative,
    representativeMediaPriority: Number(REPRESENTATIVE_MEDIA_PRIORITY[crew] && REPRESENTATIVE_MEDIA_PRIORITY[crew][id] || 0),
    activityDurationDays,
    extractionQuality: extraction.score,
    extractionComplete: extraction.complete
  };
}

async function invokeCrewNews(req, params) {
  let statusCode=200;
  let body=null;
  const headers={...(req?.headers||{})};
  const fakeReq={
    method:'GET',
    url:'/api/crew-news?'+params.toString(),
    headers,
    _soopMetrics:req && req._soopMetrics || null
  };
  const fakeRes={
    status(code){statusCode=Number(code)||500;return this;},
    json(payload){body=payload;return payload;},
    setHeader(){},
    end(payload){
      if(payload&&body==null){try{body=JSON.parse(String(payload))}catch{body=payload}}
      return payload;
    }
  };
  await crewNewsHandler(fakeReq,fakeRes);
  return{status:statusCode,body};
}

function semanticTokens(value) {
  const stop = new Set(['크루','방송','오늘','내일','모레','예정','진행','공지','일정','특집','같이','함께']);
  return [...new Set(String(value || '').toLowerCase()
    .replace(/[^가-힣a-z0-9]+/g,' ').split(/\s+/)
    .filter(token => token.length >= 2 && !stop.has(token)))];
}

function activityTokens(post) {
  return semanticTokens(post && (post.displaySummary || post.strictActivity || post.summary || ''));
}

function activityFamily(value='') {
  const text=String(value||'').toLowerCase();
  if(/회의/.test(text)) return 'meeting';
  if(/러닝|달리기/.test(text)) return 'running';
  if(/여행|엠티|\bmt\b/.test(text)) return 'travel';
  if(/윷놀이/.test(text)) return 'yut';
  if(/사냥\s*대결|더\s*헌터|대결|대항전|\bvs\b/.test(text)) return 'contest';
  if(/소울\s*체인드|soul\s*chained|체인투게더/.test(text)) return 'soulchained';
  if(/1\s*주년|주년/.test(text)) return 'anniversary';
  if(/합방/.test(text)) return 'collab';
  if(/모캡/.test(text)) return 'mocap';
  if(/모집|면접|영입|신규\s*멤버|신입\s*멤버|합격/.test(text)) return 'recruit';
  if(/특집/.test(text)) return 'special';
  return '';
}

function applyContinuousEventContext(candidates) {
  const list=(Array.isArray(candidates)?candidates:[]).map(item=>({...item}));
  const windows=[];
  for (const row of list) {
    if (activityFamily(row.strictActivity||row.displaySummary||'') !== 'travel') continue;
    const start=String(row.activityDate||'').slice(0,10);
    const days=Number(row.activityDurationDays||0);
    if (!start || days<2) continue;
    windows.push({
      crew:String(row.strictCrew||''),
      start,
      end:addIsoDays(start,days-1)
    });
  }
  windows.sort((a,b)=>a.crew.localeCompare(b.crew)||a.start.localeCompare(b.start));
  const merged=[];
  for (const window of windows) {
    const prev=merged[merged.length-1];
    if (prev && prev.crew===window.crew && window.start<=prev.end) {
      if (window.end>prev.end) prev.end=window.end;
    } else {
      merged.push({...window});
    }
  }
  for (const row of list) {
    if (activityFamily(row.strictActivity||row.displaySummary||'') !== 'travel') continue;
    const observed=String(row.activityDate||'').slice(0,10);
    const window=merged.find(item=>item.crew===String(row.strictCrew||'') && observed>=item.start && observed<=item.end);
    if (!window) continue;
    row.observedActivityDate=observed;
    row.activityDate=window.start;
    row.continuousEventStartDate=window.start;
    row.continuousEventEndDate=window.end;
    if (observed!==window.start) row.activityDateSource='continuous-event';
  }
  return list;
}

function sameNewsScore(selected, candidate) {
  if (!selected || !candidate) return -1;
  if (String(selected.strictCrew||'') !== String(candidate.strictCrew||'')) return -1;

  const selectedDate=String(selected.activityDate||'').slice(0,10);
  const candidateDate=String(candidate.activityDate||'').slice(0,10);
  if (!selectedDate || !candidateDate || selectedDate !== candidateDate) return -1;

  const a=String(selected.displaySummary||selected.strictActivity||'');
  const b=String(candidate.displaySummary||candidate.strictActivity||'');
  const na=normalize(a), nb=normalize(b);
  if (!na || !nb) return -1;

  let score=0;
  if (na===nb || na.includes(nb) || nb.includes(na)) score+=18;

  const familyA=activityFamily(a);
  const familyB=activityFamily(b);
  if (familyA && familyA===familyB) score+=14;

  const crewToken=normalize(selected.strictCrew||'');
  const tokensA=semanticTokens(a).filter(token=>normalize(token)!==crewToken);
  const textB=String(
    (candidate.originalTitle||candidate.title||'')+' '+
    (candidate.contents||'')+' '+b
  ).toLowerCase();
  const hits=tokensA.filter(token=>textB.includes(token.toLowerCase()));
  score+=Math.min(12,hits.length*4);

  if (String(selected.id||'')===String(candidate.id||'')) score+=8;
  return score>=14 ? score : -1;
}

function unsuitablePostImageContext(post) {
  if (!post || !post.imageUrl) return true;
  if (REJECT_POST_IMAGE_IDS.has(String(post.id||''))) return true;

  const title=String(post.originalTitle||post.title||'');
  const body=String(post.contents||'');
  const text=(title+' '+body).replace(/\s+/g,' ');
  const activity=String(post.strictActivity||post.displaySummary||'');
  const family=activityFamily(activity);

  // Clearly personal/reward/media-only contexts are poor representative images
  // unless the same text still names a recognized crew activity.
  const weakMedia=/셀카|개인\s*사진|사진\s*자랑|짤|팬아트|방셀|굿즈|당첨|배송|상품|경품|후원\s*감사|조회수\s*달성/i.test(text);
  if (weakMedia && !family) return true;
  return false;
}

function postImageCandidateScore(selected, candidate) {
  if (!candidate || !candidate.imageUrl || unsuitablePostImageContext(candidate)) return -1;
  const same=sameNewsScore(selected,candidate);
  if (same<0) return -1;

  let score=same;
  const continuousTravel = activityFamily(selected.strictActivity||selected.displaySummary||'') === 'travel' &&
    Boolean(selected.continuousEventStartDate);
  if (String(selected.id||'')===String(candidate.id||'') && !continuousTravel) score+=100;
  if (candidate.isCrewLeader) score+=4;
  if (NOTICE_BOARD_RE.test(String(candidate.boardName||''))) score+=3;
  if (candidate.extractionComplete!==false) score+=2;
  return score;
}

function choosePostImageCandidate(selected, candidates) {
  if (!selected) return null;
  const list=Array.isArray(candidates)?candidates:[];

  // Priority 1: image attached to the selected representative post, but only
  // after it passes the same relevance gate used for every crew.
  const self=list.find(item=>String(item?.id||'')===String(selected.id||'')) || selected;
  const selfScore=postImageCandidateScore(selected,self);
  const continuousTravel = activityFamily(selected.strictActivity||selected.displaySummary||'') === 'travel' &&
    Boolean(selected.continuousEventStartDate);
  if (!continuousTravel && selfScore>=0) {
    return {
      imageUrl:self.imageUrl,
      sheetImageUrl:self.sheetImageUrl||self.imageUrl,
      imageSource:'post_self',
      imagePostId:String(self.id||''),
      imageSuitabilityScore:selfScore
    };
  }

  // For continuous travel events, search the whole event window and allow a
  // later same-event post to upgrade the representative image without replacing the news item.
  const others=list
    .filter(item=>continuousTravel || String(item?.id||'')!==String(selected.id||''))
    .map(item=>({item,score:postImageCandidateScore(selected,item)}))
    .filter(row=>row.score>=0)
    .sort((a,b)=>b.score-a.score || parseTime(b.item.sourcePublishedAt||b.item.publishedAt)-parseTime(a.item.sourcePublishedAt||a.item.publishedAt));

  if (!others.length) return null;
  const best=others[0];
  return {
    imageUrl:best.item.imageUrl,
    sheetImageUrl:best.item.sheetImageUrl||best.item.imageUrl,
    imageSource:String(best.item.id||'')===String(selected.id||'') ? 'post_self' : 'post_member',
    imagePostId:String(best.item.id||''),
    imageSuitabilityScore:best.score
  };
}

function dateOnly(value) {
  const parsed = parseTime(value);
  return parsed ? formatKstDate(new Date(parsed)) : '';
}

function vodMatchScore(post, vod) {
  if (!post || !vod) return -1;
  if (REJECT_VOD_MEDIA_IDS.has(String(vod.id||''))) return -1;
  const activityDate = post.activityDate || dateOnly(post.publishedAt);
  const vodDate = dateOnly(vod.publishedAt);
  if (!activityDate || !vodDate) return -1;
  const days = Math.abs(Date.parse(activityDate + 'T00:00:00+09:00') - Date.parse(vodDate + 'T00:00:00+09:00')) / 86400000;
  if (days > 1) return -1;

  const activity = String(post.strictActivity || post.displaySummary || '').toLowerCase();
  const title = String(vod.title || '').toLowerCase();
  const crewName = String(post.strictCrew || '').toLowerCase();
  const tokens = activityTokens(post).filter(token => token !== crewName);
  const hits = tokens.filter(token => title.includes(token));
  const exactActivity = activity.length >= 2 && title.includes(activity);
  const distinctiveHit = hits.some(token => token.length >= 3);
  const crewHit = crewName.length >= 2 && title.includes(crewName);
  const activityAliasHit = (
    /러닝/.test(activity) && /러닝|달리기/.test(title)
  ) || (
    /여행/.test(activity) && /여행|엠티|\bmt\b/i.test(title)
  ) || (
    /회의/.test(activity) && /회의/.test(title)
  ) || (
    /윷놀이/.test(activity) && /윷놀이/.test(title)
  );
  const verifiedTravelMedia = vod.verifiedEventMedia === true || Number(
    VERIFIED_VOD_MEDIA_PRIORITY[post.strictCrew] &&
    VERIFIED_VOD_MEDIA_PRIORITY[post.strictCrew][String(vod.id||'')] || 0
  ) > 0;
  if (activityFamily(activity) === 'travel' && !verifiedTravelMedia) return -1;

  const postContext = String(
    (post.title || '') + ' ' + (post.contents || '') + ' ' + activity
  ).toLowerCase();
  const sameDayCrewGroupHit = days === 0 && crewHit &&
    /단체|크루/.test(postContext) && /단체|크루/.test(title) &&
    /모임|합방|행사|특집|콘텐츠|컨텐츠|러닝|달리기/.test(title);

  // 날짜만 같은 VOD는 금지. 활동 핵심어가 직접 맞거나,
  // 같은 날 크루명이 명시된 '단체/크루 활동' VOD처럼 대표 게시글과 맥락이 함께 맞아야 한다.
  if (!exactActivity && !distinctiveHit && !(crewHit && activityAliasHit) && !sameDayCrewGroupHit) return -1;

  let score = days === 0 ? 6 : 2;
  score += exactActivity ? 8 : 0;
  score += crewHit ? 4 : 0;
  score += activityAliasHit ? 5 : 0;
  score += sameDayCrewGroupHit ? 4 : 0;
  score += hits.length * 4;

  const family=activityFamily(activity);
  if (family && family===activityFamily(title)) score+=5;
  if (crewHit && family) score+=3;

  const verifiedBoost=Number(
    VERIFIED_VOD_MEDIA_PRIORITY[post.strictCrew] &&
    VERIFIED_VOD_MEDIA_PRIORITY[post.strictCrew][String(vod.id||'')] || 0
  );
  score += verifiedBoost;
  return score;
}

const VOD_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;
const VOD_NEGATIVE_TTL_MS = 12 * 60 * 60 * 1000;
const vodFallbackCache = new Map();
const vodFallbackInflight = new Map();

function vodFallbackKey(post, stations) {
  return [String(post?.id || ''), String(post?.activityDate || ''), String(post?.displaySummary || post?.strictActivity || ''), ...(stations || [])].join('|');
}
function trimVodFallbackCache() {
  if (vodFallbackCache.size <= 80) return;
  const oldest = [...vodFallbackCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0, vodFallbackCache.size-80);
  for (const [key] of oldest) vodFallbackCache.delete(key);
}

function buildVodSearchPlan(stations, selectedStation, leaderStation) {
  const unique = [...new Set((Array.isArray(stations) ? stations : []).filter(Boolean))];
  const priority = [...new Set([selectedStation, leaderStation].filter(Boolean))]
    .filter(station => unique.includes(station));
  return {
    priority,
    secondary: unique.filter(station => !priority.includes(station))
  };
}

function isStrongVodFallbackCandidate(candidate) {
  return Boolean(
    candidate && Number(candidate.score || 0) >= 24 &&
    candidate.vod && candidate.vod.imageUrl
  );
}

function vodDetailConsistent(listVod, detailVod, station) {
  if (!listVod || !detailVod) return false;
  if (String(listVod.id || '') !== String(detailVod.id || '')) return false;
  if (detailVod.authorId && String(detailVod.authorId) !== String(station)) return false;
  if (!detailVod.imageUrl) return false;

  const clean = value => String(value || '').toLowerCase()
    .replace(/\[[^\]]*\]/g,' ')
    .replace(/[^가-힣a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  const a=clean(listVod.title);
  const b=clean(detailVod.title);
  if (!a || !b) return true;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const tokensA=new Set(a.split(' ').filter(token=>token.length>=2));
  const shared=b.split(' ').filter(token=>token.length>=2 && tokensA.has(token));
  return shared.length >= 1;
}

async function findVodFallbackUncached(post, stations, req) {
  if (!post || post.imageUrl || !Array.isArray(stations) || !stations.length) return null;

  let best = null;
  const startedAt=Date.now();
  const maxWorkMs=9500;
  const plan = buildVodSearchPlan(
    stations,
    post._station || '',
    LEADER_BY_CREW[post.strictCrew] || ''
  );
  const searchStations = [...plan.priority, ...plan.secondary].slice(0, 5);
  for (const station of searchStations) {
    if (Date.now() - startedAt > maxWorkMs) break;
    try {
      const targetDate = post.activityDate || dateOnly(post.publishedAt);
      const maxPages = plan.priority.includes(station) ? 2 : 1;

      for (let page = 1; page <= maxPages; page += 1) {
        if (Date.now() - startedAt > maxWorkMs) break;
        const params = new URLSearchParams({
          station, mode:'vods', vod_type:'review', page:String(page), per_page:'20'
        });
        const {status, body:data} = await invokeCrewNews(req, params);
        if (status < 200 || status >= 300 || !data || data.ok !== true) break;

        const vods = Array.isArray(data.vods) ? data.vods : [];
        if (!vods.length) break;

        let oldestDate = '';
        for (const vod of vods) {
          const vodDate = dateOnly(vod.publishedAt);
          if (vodDate && (!oldestDate || vodDate < oldestDate)) oldestDate = vodDate;

          const score = vodMatchScore(post, vod);
          if (score < 0 || (best && best.score >= score)) continue;
          best = {score, vod, station};
        }

        if (isStrongVodFallbackCandidate(best)) break;

        // 최신순 목록이 목표 활동일보다 하루 이상 과거로 내려가면 더 볼 필요가 없다.
        if (targetDate && oldestDate) {
          const cutoff = Date.parse(targetDate + 'T00:00:00+09:00') - 86400000;
          if (Date.parse(oldestDate + 'T00:00:00+09:00') < cutoff) break;
        }
        if (vods.length < 20) break;
      }

      if (isStrongVodFallbackCandidate(best)) break;
    } catch (_) {
      // 한 방송국의 VOD 조회 실패는 다른 방송국 후보 탐색을 막지 않는다.
    }
  }

  if (!best || best.score < 10) return null;

  // 목록 API에는 썸네일이 없는 경우가 있어, 최종 후보 1건만 상세 API로 보강한다.
  let resolvedVod = best.vod;
  if (!resolvedVod.imageUrl && resolvedVod.id) {
    try {
      const detailParams = new URLSearchParams({
        station:best.station, mode:'vod-detail', title_no:String(resolvedVod.id)
      });
      const {status, body:data} = await invokeCrewNews(req, detailParams);
      if (
        status >= 200 && status < 300 && data && data.ok === true && data.vod &&
        vodDetailConsistent(resolvedVod,data.vod,best.station)
      ) {
        resolvedVod = {
          ...resolvedVod,
          ...data.vod,
          vodUrl:resolvedVod.vodUrl || data.vod.vodUrl || ''
        };
      }
    } catch (_) {
      // 상세 썸네일 보강 실패는 대표 소식 자체의 실패로 취급하지 않는다.
    }
  }

  if (!resolvedVod.imageUrl) return null;

  return {
    fallbackImageUrl: resolvedVod.imageUrl,
    fallbackSheetImageUrl: resolvedVod.sheetImageUrl || resolvedVod.imageUrl,
    fallbackImageSource:
      best.station === (LEADER_BY_CREW[post.strictCrew] || stations[0])
        ? 'leader_vod' : 'member_vod',
    fallbackVodUrl: resolvedVod.vodUrl || best.vod.vodUrl || ''
  };
}

async function findVodFallback(post, stations, req) {
  if (!post || post.imageUrl || !Array.isArray(stations) || !stations.length) return null;
  const key = vodFallbackKey(post, stations);
  const cached = vodFallbackCache.get(key);
  if (cached) {
    const ttl = cached.value ? VOD_FALLBACK_TTL_MS : VOD_NEGATIVE_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.value;
    vodFallbackCache.delete(key);
  }
  if (vodFallbackInflight.has(key)) return vodFallbackInflight.get(key);
  const promise = findVodFallbackUncached(post, stations, req)
    .then(value => {
      vodFallbackCache.set(key,{at:Date.now(),value:value || null});
      trimVodFallbackCache();
      return value || null;
    })
    .finally(()=>vodFallbackInflight.delete(key));
  vodFallbackInflight.set(key,promise);
  return promise;
}

function imageSourceFor(post) {
  if (!post) return 'none';
  if (post.imageUrl) return String(post.imageSource || 'post');
  if (post.fallbackImageUrl) return String(post.fallbackImageSource || 'fallback');
  return 'none';
}

function applyFallbackImage(post) {
  if (!post || post.imageUrl || !post.fallbackImageUrl) return post;
  return {
    ...post,
    imageUrl: post.fallbackImageUrl,
    sheetImageUrl: post.fallbackSheetImageUrl || post.fallbackImageUrl,
    imageSource: String(post.fallbackImageSource || 'fallback')
  };
}

function displayDateFor(post) {
  const raw = String(post?.activityDate || post?.publishedAt || '').slice(0,10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? String(Number(match[2])) + '/' + String(Number(match[3])) : '';
}

function finalDisplayText(post, crew) {
  if (!post) return '';
  const summary = String(post.displaySummary || post.strictActivity || '').trim();
  const date = displayDateFor(post);
  return [crew, '-', summary, date ? '(' + date + ')' : '', '📌'].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}

function stableFingerprint(post) {
  if (!post) return '';
  const parts = [
    String(post.id || ''),
    String(post.displaySummary || post.strictActivity || ''),
    String(post.activityDate || String(post.publishedAt || '').slice(0, 10)),
    String(post.imageUrl || post.fallbackImageUrl || ''),
    imageSourceFor(post)
  ];
  // FNV-1a: Apps Script가 긴 문자열을 비교하지 않아도 되는 짧고 안정적인 변경 키.
  let hash = 2166136261;
  for (const ch of parts.join('\u001f')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
}

function mergePosts(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const post of Array.isArray(list) ? list : []) {
      const key = String(post && post.id || '');
      if (!key) continue;
      byId.set(key, post);
    }
  }
  return [...byId.values()];
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current]);
    }
  }));
  return results;
}

function setBatchPublicCache(res,{browser=300,cdn=3600,stale=21600}={}){
  res.setHeader('Cache-Control',`public, max-age=${browser}, stale-while-revalidate=${stale}`);
  res.setHeader('CDN-Cache-Control',`public, max-age=${cdn}, stale-while-revalidate=${stale}`);
  res.setHeader('Vercel-CDN-Cache-Control',`public, max-age=${cdn}, stale-while-revalidate=${stale}`);
}
function setBatchNoStore(res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('CDN-Cache-Control','no-store');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
}

module.exports = async function handler(req, res) {
  // 응답 자체에 빌드 식별자를 노출해 Apps Script가 실제 최신 Production 함수를
  // 호출하는지 상태 시트에서 즉시 검증할 수 있게 한다.
  res.setHeader('X-Crew-News-Policy', POLICY_VERSION);
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const requestUrl = new URL(req.url || '/', 'https://chunbong.local');
  const forceRefresh = requestUrl.searchParams.get('refresh') === '1';
  const previousFingerprint = String(requestUrl.searchParams.get('previous_fingerprint') || '').trim().slice(0, 128);
  const stations = safeStations(requestUrl.searchParams.get('stations') || '');
  if (!stations.length) return res.status(400).json({ error: 'invalid_stations' });

  const soopMetrics = typeof crewNewsInternals.createSoopRequestMetrics === 'function'
    ? crewNewsInternals.createSoopRequestMetrics()
    : {};
  req._soopMetrics = soopMetrics;
  const snapshotSoopMetrics = () => typeof crewNewsInternals.snapshotSoopRequestMetrics === 'function'
    ? crewNewsInternals.snapshotSoopRequestMetrics(soopMetrics)
    : soopMetrics;

  const perPage = intParam(requestUrl.searchParams.get('per_page'), 30, 1, 50);
  const keyword = String(requestUrl.searchParams.get('keyword') || '').trim().slice(0, 120);
  const startDate = String(requestUrl.searchParams.get('start_date') || '').trim().slice(0, 32);
  const endDate = String(requestUrl.searchParams.get('end_date') || '').trim().slice(0, 32);
  const crew = inferCrew(stations);

  const results = await mapLimit(stations, 5, async station => {
    const params = new URLSearchParams({
      station,
      per_page: String(perPage),
      keyword,
      start_date: startDate,
      end_date: endDate
    });
    if (crew) params.set('crew', crew);
    if (forceRefresh) params.set('refresh', '1');
    try {
      const { status, body } = await invokeCrewNews(req, params);
      if (status < 200 || status >= 300 || !body || body.ok !== true) {
        return { station, ok: false, status, error: body && body.error ? body.error : 'crew_news_failed' };
      }

      let rawPosts = Array.isArray(body.posts) ? body.posts : [];
      let extraSearchFailed = false;
      const extras = (EXTRA_SEARCHES[crew] || []).filter(item => item.station === station);
      for (const extra of extras) {
        const extraParams = new URLSearchParams({
          station,
          per_page: '50',
          keyword: extra.keyword,
          start_date: startDate,
          end_date: endDate
        });
        if (forceRefresh) extraParams.set('refresh', '1');
        try {
          const extraFetch = await invokeCrewNews(req, extraParams);
          if (extraFetch.status >= 200 && extraFetch.status < 300 && extraFetch.body && extraFetch.body.ok === true) {
            rawPosts = mergePosts(rawPosts, extraFetch.body.posts);
            if (extraFetch.body.stale === true || extraFetch.body.menuError) extraSearchFailed = true;
          } else {
            extraSearchFailed = true;
          }
        } catch (_) {
          extraSearchFailed = true;
        }
      }

      const posts = crew ? rawPosts.map(post => strictCrewPost(post, crew, station)).filter(Boolean) : rawPosts;
      return {
        station,
        ok: true,
        authenticated: Boolean(body.authenticated),
        stale: Boolean(body.stale),
        snapshotAt: body.snapshotAt || '',
        metadataDegraded: Boolean(body.menuError),
        count: posts.length,
        rawCount: rawPosts.length,
        strictFiltered: Boolean(crew),
        extraSearchFailed,
        posts
      };
    } catch (error) {
      return {
        station,
        ok: false,
        status: 0,
        error: error && error.name === 'AbortError' ? 'timeout' : String(error && error.message || error)
      };
    }
  });

  let selected = null;
  if (crew) {
    const candidates = [];
    for (const result of results) {
      if (!result || !result.ok) continue;
      for (const post of result.posts || []) candidates.push({ ...post, _station: result.station });
    }
    const contextualCandidates=applyContinuousEventContext(candidates);
    contextualCandidates.sort(compareRepresentativeCandidates);
    selected = contextualCandidates[0] || null;

    if (selected) {
      const originalPostImageUrl=selected.imageUrl||'';
      const originalPostSheetImageUrl=selected.sheetImageUrl||'';
      const chosenPostImage=choosePostImageCandidate(selected,contextualCandidates);
      selected={
        ...selected,
        originalPostImageUrl,
        originalPostSheetImageUrl,
        imageUrl:chosenPostImage ? chosenPostImage.imageUrl : '',
        sheetImageUrl:chosenPostImage ? chosenPostImage.sheetImageUrl : '',
        imageSource:chosenPostImage ? chosenPostImage.imageSource : 'none',
        imagePostId:chosenPostImage ? chosenPostImage.imagePostId : '',
        imageSuitabilityScore:chosenPostImage ? chosenPostImage.imageSuitabilityScore : null,
        imageRejected:Boolean(originalPostImageUrl && !chosenPostImage)
      };
    }

    if (
      selected &&
      (selected.extractionComplete === false || !selected.imageUrl) &&
      typeof crewNewsInternals.verifyPublicPost === 'function'
    ) {
      try {
        const verification = await crewNewsInternals.verifyPublicPost(
          selected._station,
          selected.id,
          req
        );
        selected.publicVerification = verification
          ? String(verification.reason || (verification.verified ? 'verified' : 'unverified'))
          : 'unavailable';
        if (
          verification && verification.verified &&
          !selected.imageUrl && verification.imageUrl
        ) {
          selected.imageUrl = verification.imageUrl;
          selected.sheetImageUrl = verification.sheetImageUrl || verification.imageUrl;
          selected.imageSource = 'post_self_verified';
          selected.imagePostId = String(selected.id||'');
        }
      } catch (_) {
        selected.publicVerification = 'unavailable';
      }
    }

    // 대표 소식 선정은 VOD 조회와 분리한다. VOD/썸네일 보조 조회 실패가
    // 이미 검증된 대표 소식 전체를 500으로 만들지 않도록 한다.
    if (selected && !selected.imageUrl) {
      const orderedStations = [
        ...new Set([
          selected._station,
          LEADER_BY_CREW[crew],
          ...stations
        ].filter(Boolean))
      ];
      try {
        const fallback = await findVodFallback(selected, orderedStations, req);
        if (fallback) selected = {...selected, ...fallback};
      } catch (_) {
        // 이미지 보조 조회 실패는 비치명적이다. 대표 소식/기존 이미지는 그대로 유지한다.
      }
    }
    if (selected) selected = applyFallbackImage(selected);

    // 외부 검색이 일시적으로 빈 결과를 반환하더라도 검증된 마지막 대표 소식을
    // "허용 후보 없음"으로 오판해 시트에서 지우지 않도록 안전 폴백을 사용한다.
    if (!selected && FALLBACK_REPRESENTATIVE[crew]) {
      selected = { ...FALLBACK_REPRESENTATIVE[crew], _station: FALLBACK_REPRESENTATIVE[crew].station };
      const targetResult = results.find(result => result && result.station === selected._station);
      if (targetResult && targetResult.ok) {
        targetResult.posts = [{ ...selected }];
        targetResult.count = 1;
      }
    }

    // 기존 Apps Script가 자체 선정하지 않아도 서버 대표 후보 하나만 보도록 제한한다.
    for (const result of results) {
      if (!result || !result.ok) continue;
      result.posts = selected && result.station === selected._station
        ? (result.posts || []).filter(post => String(post.id) === String(selected.id))
        : [];
      result.count = result.posts.length;
    }
  }

  const failures = results.filter(item => !item.ok);
  const auxiliaryFailures = results.filter(item => item && item.ok && item.extraSearchFailed);
  const staleSources = results.filter(item => item && item.ok && item.stale);
  const degradedSources = results.filter(item => item && item.ok && item.metadataDegraded);
  const reliableEmpty =
    !selected &&
    failures.length === 0 &&
    auxiliaryFailures.length === 0 &&
    staleSources.length === 0 &&
    degradedSources.length === 0;

  // raw 게시글은 존재하지만 엄격 필터에서 대표 후보가 하나도 남지 않은 경우는
  // 실제 "소식 없음"과 구분한다. 이 상태에서는 기존 정상 시트 값을 지우지 않는다.
  const rawCandidateCount = results.reduce((sum,item) => sum + (item && item.ok ? Number(item.rawCount || 0) : 0), 0);
  const suspiciousEmpty = Boolean(crew && !selected && rawCandidateCount > 0 && reliableEmpty);
  const healthStatus =
    failures.length || auxiliaryFailures.length || staleSources.length || degradedSources.length ? 'degraded' :
    selected ? 'healthy' :
    suspiciousEmpty ? 'suspicious_empty' : 'no_news';
  const preservePrevious = healthStatus === 'degraded' || healthStatus === 'suspicious_empty';
  const selectedFingerprint = selected ? stableFingerprint(selected) : '';
  const unchanged = Boolean(selectedFingerprint && previousFingerprint && selectedFingerprint === previousFingerprint);
  const shouldWrite = !preservePrevious && !unchanged;
  const updateAction = preservePrevious ? 'preserve_previous' : unchanged ? 'skip_unchanged' : 'write';

  // 후보가 비었는데 일부 방송국/보조 검색이 실패했다면 "소식 없음"이 아니라 조회 실패다.
  // 200 + 빈 후보를 반환하면 Apps Script가 기존 정상 소식을 지울 수 있으므로 오류 응답으로 보존시킨다.
  if (
    crew && !selected &&
    (failures.length > 0 || auxiliaryFailures.length > 0 || staleSources.length > 0 || degradedSources.length > 0)
  ) {
    setBatchNoStore(res);
    return res.status(503).json({
      ok: false,
      complete: false,
      error: 'crew_news_incomplete',
      policyVersion: POLICY_VERSION,
      strictCrew: crew,
      requested: stations.length,
      failed: failures.length,
      auxiliaryFailed: auxiliaryFailures.length,
      staleSources: staleSources.length,
      degradedSources: degradedSources.length,
      preservePrevious: true,
      healthStatus: 'degraded',
      rawCandidateCount,
      soopMetrics: snapshotSoopMetrics()
    });
  }

  const authenticated = results.some(item => item && item.authenticated === true);
  if(forceRefresh || authenticated)setBatchNoStore(res);
  else if(failures.length>0 || auxiliaryFailures.length>0)setBatchPublicCache(res,{browser:30,cdn:60,stale:120});
  // Apps Script는 대표 소식의 최종 authority를 이 endpoint에서 받는다.
  // 배포 직후 이전 정책 응답이 장시간 남지 않도록 batch 최종 응답은 짧게 캐시한다.
  else setBatchPublicCache(res,{browser:30,cdn:60,stale:120});
  return res.status(failures.length === results.length ? 502 : 200).json({
    ok: failures.length < results.length,
    complete:
      failures.length === 0 &&
      auxiliaryFailures.length === 0 &&
      staleSources.length === 0 &&
      degradedSources.length === 0,
    policyVersion: POLICY_VERSION,
    soopMetrics: snapshotSoopMetrics(),
    strictCrew: crew || '',
    keyword,
    requested: stations.length,
    succeeded: results.length - failures.length,
    failed: failures.length,
    auxiliaryFailed: auxiliaryFailures.length,
    staleSources: staleSources.length,
    degradedSources: degradedSources.length,
    reliableEmpty: reliableEmpty && !suspiciousEmpty,
    suspiciousEmpty,
    healthStatus,
    preservePrevious,
    rawCandidateCount,
    selectedFingerprint,
    previousFingerprint,
    unchanged,
    shouldWrite,
    updateAction,
    selected: selected ? {
      id: selected.id,
      station: selected._station,
      postUrl: selected.postUrl,
      summary: selected.strictActivity,
      displaySummary: selected.displaySummary || selected.strictActivity,
      extractionQuality: selected.extractionQuality ?? null,
      extractionComplete: selected.extractionComplete !== false,
      displayDate: displayDateFor(selected),
      displayText: finalDisplayText(selected, crew),
      publishedAt: selected.publishedAt,
      sourcePublishedAt: selected.sourcePublishedAt || selected.publishedAt,
      activityDate: selected.activityDate || String(selected.publishedAt || '').slice(0, 10),
      activityDateSource: selected.activityDateSource || 'published',
      publicVerification:
        selected.publicVerification ||
        (selected.extractionComplete === false ? 'not_checked' : 'not_required'),
      imageUrl: selected.imageUrl || '',
      sheetImageUrl: selected.sheetImageUrl || '',
      imageSource: selected.imageSource || imageSourceFor(selected),
      imagePostId: selected.imagePostId || '',
      imageSuitabilityScore: selected.imageSuitabilityScore ?? null,
      imageRejected: Boolean(selected.imageRejected),
      fallbackVodUrl: selected.fallbackVodUrl || '',
      fingerprint: stableFingerprint(selected),
      representativeTier: selected.representativeTier,
      isCrewLeader: selected.isCrewLeader
    } : null,
    results
  });
};

module.exports._internals = {
  safeStations,
  intParam,
  postExtractionQuality,
  inferCrew,
  detectActivity,
  deriveCompetitiveDisplaySummary,
  sameRepresentativeActivity,
  compareRepresentativeCandidates,
  strictCrewPost,
  parseTime,
  resolveActivityDate,
  resolveActivityDateInfo,
  parseActivityDurationDays,
  applyContinuousEventContext,
  activityPublishedAt,
  vodDetailConsistent,
  stableFingerprint,
  displayDateFor,
  finalDisplayText,
  activityTokens,
  activityFamily,
  sameNewsScore,
  unsuitablePostImageContext,
  postImageCandidateScore,
  choosePostImageCandidate,
  vodMatchScore,
  buildVodSearchPlan,
  isStrongVodFallbackCandidate,
  findVodFallback,
  vodFallbackKey,
  imageSourceFor,
  applyFallbackImage,
  mergePosts,
  classifyHealth({selected=null,results=[],failures=[],auxiliaryFailures=[],staleSources=[],degradedSources=[]}={}) {
    const reliableEmpty=!selected&&!failures.length&&!auxiliaryFailures.length&&!staleSources.length&&!degradedSources.length;
    const rawCandidateCount=results.reduce((sum,item)=>sum+(item&&item.ok?Number(item.rawCount||0):0),0);
    const suspiciousEmpty=Boolean(!selected&&rawCandidateCount>0&&reliableEmpty);
    const healthStatus=failures.length||auxiliaryFailures.length||staleSources.length||degradedSources.length?'degraded':selected?'healthy':suspiciousEmpty?'suspicious_empty':'no_news';
    return {healthStatus,suspiciousEmpty,preservePrevious:healthStatus==='degraded'||healthStatus==='suspicious_empty',rawCandidateCount};
  }
};
