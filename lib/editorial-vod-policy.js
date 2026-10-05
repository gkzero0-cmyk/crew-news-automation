'use strict';

function kstDateNow(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now);
  const get=type=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toDateOnly(value='') {
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function dayDistance(a='',b='') {
  const da=toDateOnly(a), db=toDateOnly(b);
  if (!da || !db) return Infinity;
  return Math.abs(Date.parse(da+'T00:00:00Z')-Date.parse(db+'T00:00:00Z'))/86400000;
}

function isConcreteActivity(activity='') {
  const value=String(activity||'').trim();
  if (!value) return false;
  return !/^(?:모집|합방|콘텐츠|컨텐츠|일정|행사|모임|대회|면접)$/i.test(value);
}

function activityTitleMatches(activity='',title='') {
  const a=String(activity||'').trim();
  const t=String(title||'');
  if (!a || !t) return false;
  if (/나들이/i.test(a)) return /나들이/i.test(t);
  if (/뇌피셜\s*게임/i.test(a)) return /뇌피셜/i.test(t) && /게임/i.test(t);

  const tokens=a.toLowerCase()
    .replace(/[^가-힣a-z0-9]+/g,' ')
    .split(/\s+/)
    .filter(token=>token.length>=2 && !/^(?:크루|방송|콘텐츠|컨텐츠|게임)$/.test(token));
  return tokens.length>0 && tokens.every(token=>t.toLowerCase().includes(token));
}

function chooseVodCandidate(selected, vods=[], now=new Date()) {
  if (!selected || selected.imageUrl) return null;
  const activity=String(selected.summary||selected.displaySummary||'').trim();
  const activityDate=toDateOnly(selected.activityDate||selected.publishedAt||'');
  if (!isConcreteActivity(activity) || !activityDate) return null;
  if (activityDate>kstDateNow(now)) return null;

  return (Array.isArray(vods)?vods:[])
    .filter(v=>dayDistance(activityDate,v.publishedAt)<=1 && activityTitleMatches(activity,v.title))
    .sort((a,b)=>dayDistance(activityDate,a.publishedAt)-dayDistance(activityDate,b.publishedAt))[0] || null;
}

module.exports={
  kstDateNow,
  toDateOnly,
  dayDistance,
  isConcreteActivity,
  activityTitleMatches,
  chooseVodCandidate
};
