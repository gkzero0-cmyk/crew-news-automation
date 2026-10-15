'use strict';

// Asia/Seoul is the broadcast schedule timezone, regardless of server region.
function kstToday(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now);
  const get=type=>parts.find(row=>row.type===type)?.value||'';
  return get('year')+'-'+get('month')+'-'+get('day');
}

function isIsoDay(value) {
  return /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(String(value||''));
}

// 0: today; 1: nearest upcoming event; 2: most recent past event.
// Do not infer a date for undated posts. Caller preserves its prior fallback.
function compareActivityDays(a,b,today=kstToday()) {
  const left=String(a||'').slice(0,10);
  const right=String(b||'').slice(0,10);
  if(!isIsoDay(left)||!isIsoDay(right)||left===right) return 0;
  const group=day=>day===today?0:(day>today?1:2);
  const l=group(left),r=group(right);
  if(l!==r)return l-r;
  if(l===1)return left<right?-1:1; // Closest scheduled event first
  if(l===2)return left>right?-1:1; // Most recent concluded event first
  return 0;
}

module.exports={kstToday,compareActivityDays};
