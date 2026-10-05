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

function inferSpecificActivity(text='', currentActivity='') {
  const raw=String(text||'');
  const current=String(currentActivity||'').trim();

  if (/뇌피셜\s*게임/i.test(raw)) return '뇌피셜 게임';
  if (/나들이/i.test(raw) && /합방|나들이/i.test(current+' '+raw)) return '나들이';

  if (/모집/i.test(current)) {
    if (isExplicitCrewRecruitment(raw)) return '';
    const named=namedRecruitmentActivity(raw);
    if (named) return named;
  }

  return '';
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
  const current=stripCrewPrefix(selected.displaySummary||selected.summary||'',crew);
  const evidence=selectedEvidenceText(payload);
  const inferred=inferSpecificActivity(evidence,current);
  const label=inferred||current;
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

function applyOutputPolicy(payload, options={}) {
  if (!payload || payload.ok!==true || !payload.selected || payload.preservePrevious===true) return payload;
  const titleResult=applyEditorialTitle(payload);
  const imageResult=ensureBlankImageDirective(titleResult.payload,options.blankUrl||DEFAULT_BLANK_SHEET_IMAGE_URL);
  const changed=titleResult.changed||imageResult.changed;
  return refreshFingerprintState(imageResult.payload,options.stableFingerprint,changed);
}

module.exports={
  DEFAULT_BLANK_SHEET_IMAGE_URL,
  normalize,
  stripCrewPrefix,
  selectedPostFromPayload,
  selectedEvidenceText,
  isExplicitCrewRecruitment,
  namedRecruitmentActivity,
  inferSpecificActivity,
  applyEditorialTitle,
  ensureBlankImageDirective,
  selectedFingerprintInput,
  refreshFingerprintState,
  applyOutputPolicy
};
