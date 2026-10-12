'use strict';

const {dayDistance}=require('./editorial-vod-policy.js');

const GENERIC_ACTIVITY_RE=/^(?:크루\s*합방|합방|크루\s*콘텐츠|콘텐츠|컨텐츠|대회|행사|모임)$/i;

function isGenericForVodConsensus(activity='') {
  return GENERIC_ACTIVITY_RE.test(String(activity||'').trim());
}

function normalizeTitle(title='', crew='') {
  let value=String(title||'').replace(/\s+/g,' ').trim();
  const crewRaw=String(crew||'').trim();
  if (crewRaw) {
    const escaped=crewRaw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    value=value.replace(new RegExp('\\[?'+escaped+'\\]?','gi'),' ');
  }
  return value.replace(/\s+/g,' ').trim();
}

function extractVodActivities(title='', crew='') {
  const raw=normalizeTitle(title,crew);
  const out=[];
  if (!raw) return out;

  const football=/(?:피파\s*4?|fc\s*온라인|fc온라인)/i.test(raw);
  if (football && /내전/i.test(raw)) {
    const ratio=raw.match(/(\d{1,2})\s*[:xX]\s*(\d{1,2})/);
    if (ratio) {
      out.push({
        label:'피파 '+Number(ratio[1])+':'+Number(ratio[2])+' 내전',
        signature:'football:'+Number(ratio[1])+':'+Number(ratio[2])+':내전',
        specificity:100
      });
    } else {
      out.push({label:'피파 내전',signature:'football:any:내전',specificity:80});
    }
    return out;
  }

  const latin=raw.match(/(?:^|[^A-Za-z0-9])([A-Za-z][A-Za-z0-9.+_!?-]{1,24})\s*(합방|내전|대결|대회)/i);
  if (latin) {
    const name=String(latin[1]||'').trim();
    const type=String(latin[2]||'').trim();
    if (name && !/^(?:today|crew|team|with|vrc|vr)$/i.test(name)) {
      out.push({label:name+' '+type,signature:'named:'+name.toLowerCase()+':'+type,specificity:90});
      return out;
    }
  }

  const korean=raw.match(/(?:^|[^가-힣])([가-힣]{2,12})\s*(합방|내전|대결|대회)(?=$|[^가-힣])/);
  if (korean) {
    const name=String(korean[1]||'').trim();
    const type=String(korean[2]||'').trim();
    if (name && !/^(?:크루|오늘|내일|방송|콘텐츠|컨텐츠)$/.test(name)) {
      out.push({label:name+' '+type,signature:'named:'+name+':'+type,specificity:88});
    }
  }

  return out;
}

function stationEnt...[truncated]    .sort((a,b)=>b.supportCount-a.supportCount || b.specificity-a.specificity || b.label.length-a.label.length);

  return candidates[0]||null;
}

function pickRepresentativeVod(consensus,{preferredStation=''}={}) {
  if (!consensus || !Array.isArray(consensus.supporters) || !consensus.supporters.length) return null;
  const preferred=String(preferredStation||'');
  const ranked=[...consensus.supporters].sort((a,b)=>{
    const ap=a.station===preferred?1:0;
    const bp=b.station===preferred?1:0;
    return bp-ap ||
      Number(b.specificity||0)-Number(a.specificity||0) ||
      Number(a.distance||0)-Number(b.distance||0) ||
      String(a.vod&&a.vod.title||'').length-String(b.vod&&b.vod.title||'').length;
  });
  return ranked[0]?.vod||null;
}

module.exports={
  isGenericForVodConsensus,
  normalizeTitle,
  extractVodActivities,
  findVodConsensus,
  pickRepresentativeVod
};
