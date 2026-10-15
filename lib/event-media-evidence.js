'use strict';

// Strict common-event signal for selecting media from ANOTHER post.
// Same crew + calendar date + "합방" is NOT proof of the same program.
const SIGNATURES=[
  ['trash-day',/\btrash\s*day\b/i],
  ['moo-who',/\bmoo\s*who\b/i],
  ['peak',/\bpeak\b/i],
  ['repo',/\br\.?\s*e\.?\s*p\.?\s*o\.?\b/i],
  ['mystery',/미스테리|미스터리/i],
  ['roblox',/로(?:블|볼)록스/i],
  ['escape-room',/방\s*탈출/i],
  ['vrc',/\bvrc\b/i],
  ['vr',/\bvr\b/i],
  ['nolsup',/놀숲/i],
  ['yut',/윷놀이/i],
  ['fifa',/피파|fc\s*온라인|엪온/i],
  ['counseling',/상담\s*(?:콘텐츠|컨텐츠|소)/i],
  ['roll-call',/점호/i],
  ['regular-meeting',/정기\s*회의/i],
  ['meeting',/(?:비방\s*)?회의/i],
  ['outing',/나들이/i],
  ['trip',/여행|엠티|\bmt\b/i]
];
const SOFT=new Set(['vrc','vr','meeting','regular-meeting','roll-call','outing','trip','yut']);
function postText(row){
  return [row?.strictActivity,row?.displaySummary,row?.summary,row?.activity,
    row?.originalTitle,row?.contents].filter(Boolean).join('\n');
}
function signatures(row) {
  const src=postText(row);
  const out=new Set();
  for(const [name,re] of SIGNATURES)if(re.test(src))out.add(name);
  return out;
}
function conflictingNamedPrograms(a,b) {
  const gameNames=['trash-day','moo-who','peak','repo','mystery','roblox','nolsup','fifa','counseling'];
  const aNamed=gameNames.filter(n=>a.has(n));
  const bNamed=gameNames.filter(n=>b.has(n));
  if(aNamed.length&&bNamed.length&&!aNamed.some(n=>bNamed.includes(n)))return true;
  return (a.has('vrc')&&b.has('vr')&&!b.has('vrc')) ||
    (a.has('vr')&&!a.has('vrc')&&b.has('vrc')&&!b.has('vr'));
}
function sameEventImageEvidence(selected,candidate) {
  if(!selected||!candidate)return false;
  if(String(selected.id||'')&&String(selected.id)===String(candidate.id||''))return true;
  const a=signatures(selected),b=signatures(candidate);
  if(conflictingNamedPrograms(a,b))return false;
  const shared=[...a].filter(n=>b.has(n));
  if(shared.length){
    const gameNames=new Set(['trash-day','moo-who','peak','repo','mystery','roblox','nolsup','fifa','counseling']);
    if(shared.some(n=>gameNames.has(n)))return true;
    // VR alone or a generic meeting is not enough to associate two different
    // events if either original mentions a separate named program.
    const aNamed=[...a].some(n=>gameNames.has(n));
    const bNamed=[...b].some(n=>gameNames.has(n));
    if(!aNamed&&!bNamed&&shared.some(n=>SOFT.has(n)))return true;
  }
  // Two generic notices may explicitly refer to the SAME announcement.
  // A link to the selected ID is stronger than matching generic vocabulary.
  const selectedId=String(selected.id||'').trim();
  const candidateSource=[candidate.originalTitle,candidate.contents].join(' ');
  if(selectedId&&/^\d{6,}$/.test(selectedId) &&
    new RegExp('/post/'+selectedId+'(?:[^0-9]|$)').test(candidateSource))return true;
  return false;
}
module.exports={signatures,conflictingNamedPrograms,sameEventImageEvidence};
