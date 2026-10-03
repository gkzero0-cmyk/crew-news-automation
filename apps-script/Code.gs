/**

 * 신생 종겜 크루 멤버 현황 - 15분 자동 갱신 (서버 단일 판정 v5 + fingerprint diagnostics)

 * 대상 시트: 1-mACl-yykHphsqiSUNPkoC1GHydOYmWX-xHqdRz7DVM

 *

 * 사용 방법

 * 1) 대상 Google Sheet > 확장 프로그램 > Apps Script

 * 2) 이 파일 전체를 Code.gs에 붙여넣고 저장

 * 3) installCrewNewsAutomation()을 한 번 실행하고 권한 승인

 *    - 즉시 1회 갱신

 *    - 이후 15분마다 자동 갱신

 */



const CREW_AUTOMATION = Object.freeze({

  SPREADSHEET_ID: '1-mACl-yykHphsqiSUNPkoC1GHydOYmWX-xHqdRz7DVM',

  SCRIPT_VERSION: 'crew-apps-script-v1.7.3',

  MAIN_SHEET: '신생 종겜 크루',

  CONFIG_SHEET: '자동화 설정',

  STATUS_SHEET: '자동화 상태',

  HEADER_CELL: 'B2',

  API_BASE: 'https\://crew-news-automation.vercel.app',

  TIMEZONE: 'Asia/Seoul',

  TRIGGER_MINUTES: 15,

  FETCH_PER_PAGE: 30,

  MAX_POST_AGE_DAYS: 45,

  COLORS: {

    '조적단': '#f75385',

    '강씨세가': '#dab04d',

    '진드기': '#128417',

    '천타버스': '#61ffec',

    'ZZAM지트': '#7223a3',

    '장지수용소': '#95e0d3',

    '머리퍼리': '#fef3c9',

    '자라섬': '#63ac3d'

  },

  ACTIVITY_TERMS: [

    '크루','합방','중계합방','종겜합방','회의','정기회의','모집','일정','행사','콘텐츠','컨텐츠',

    '회식','여행','엠티','MT','면접','합격','가입','탈퇴','영입','졸업','창단','모임','대회','세미',

    '마피아','메이드카페','모캡','체인드','합류','신입','신규멤버','멤버변동','멤버 변동','공지'

  ],

  STRONG_ACTIVITY_TERMS: [

    '크루','합방','회의','정기회의','모집','일정','행사','회식','여행','엠티','MT','면접','합격','가입','탈퇴','영입','졸업','창단','모임','대회','합류','신규멤버','멤버 변동'

  ],

  HIGH_PRIORITY_BOARD_TERMS: ['공지', '공지사항', '크루'],

  GENERIC_TITLE_PATTERNS: [

    /^\d{6}\s*(?:오늘|공지|방송|일정)?\s*$/i,

    /^오늘(?:의)?\s*(?:방송|공지|일정)?\s*$/i,

    /^오뱅(?:공|공지)?\s*$/i,

    /^공지\s*$/i

  ]

});



function onOpen() {

  SpreadsheetApp.getUi()

    .createMenu('크루 자동화')

    .addItem('지금 갱신', 'refreshCrewNews')

    .addItem('15분 자동갱신 설치', 'installCrewNewsAutomation')

    .addItem('자동갱신 제거', 'uninstallCrewNewsAutomation')

    .addToUi();

}



function installCrewNewsAutomation() {

  assertTargetSpreadsheet_();

  removeCrewTriggers_();

  ScriptApp.newTrigger('refreshCrewNews')

    .timeBased()

    .everyMinutes(CREW_AUTOMATION.TRIGGER_MINUTES)

    .create();



  PropertiesService.getDocumentProperties().setProperties({

    CREW_AUTOMATION_INSTALLED: 'true',

    CREW_AUTOMATION_INTERVAL: String(CREW_AUTOMATION.TRIGGER_MINUTES),

    CREW_AUTOMATION_INSTALLED_AT: new Date().toISOString()

  }, true);

  // 새 쓰기 정책 설치 시 첫 1회는 서버와 시트 상태를 다시 동기화한다.
  clearAllCrewFingerprints_();



  setAutomationState_('ACTIVE');

  refreshCrewNews();

}



function uninstallCrewNewsAutomation() {

  removeCrewTriggers_();

  const props = PropertiesService.getDocumentProperties();

  props.deleteProperty('CREW_AUTOMATION_INSTALLED');

  props.deleteProperty('CREW_AUTOMATION_INTERVAL');

  props.deleteProperty('CREW_AUTOMATION_INSTALLED_AT');

  clearAllCrewFingerprints_();

  setAutomationState_('INACTIVE');

}



function removeCrewTriggers_() {

  ScriptApp.getProjectTriggers().forEach(function(trigger) {

    if (trigger.getHandlerFunction() === 'refreshCrewNews') {

      ScriptApp.deleteTrigger(trigger);

    }

  });

}



function refreshCrewNews() {

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(5000)) return;



  const startedAt = new Date();

  try {

    const ss = assertTargetSpreadsheet_();

    const main = ss.getSheetByName(CREW_AUTOMATION.MAIN_SHEET);

    const configSheet = ss.getSheetByName(CREW_AUTOMATION.CONFIG_SHEET);

    const statusSheet = ss.getSheetByName(CREW_AUTOMATION.STATUS_SHEET);

    if (!main || !configSheet || !statusSheet) {

      throw new Error('자동화 설정/상태 시트가 없습니다. 설정 시트를 다시 만들어 주세요.');

    }



    const crews = readCrewConfig_(configSheet);

    const runResults = [];

    let hardFailure = false;

    // 정상 경로에서는 8개 크루를 단일 Vercel 함수 호출로 가져온다.
    // 집계 endpoint 자체가 실패한 경우에만 기존 크루별 호출로 폴백한다.
    const diagnostics = { batchRequests: 0, fallbackRequests: 0, batchReceived: false };
    let batchPayloads = {};
    try {
      batchPayloads = fetchAllCrewBatches_(crews, diagnostics);
      diagnostics.batchReceived = true;
    } catch (batchError) {
      batchPayloads = {};
    }



    crews.forEach(function(crew) {

      try {

        const result = refreshOneCrew_(main, crew, batchPayloads[crew.crew] || null, diagnostics);

        runResults.push(result);

        if (result.apiFailed) hardFailure = true;

      } catch (error) {

        hardFailure = true;

        runResults.push({

          crew: crew.crew,

          checkedAt: startedAt,

          changed: false,

          apiFailed: true,

          error: String(error && error.message || error),

          sourceType: '',

          imageState: '오류'

        });

      }

    });



    writeStatus_(statusSheet, runResults);



    if (!hardFailure && runResults.length === crews.length) {

      writeHeaderTimestamp_(main, new Date());

    }

    diagnostics.outcome = hardFailure ? 'completed_with_errors' : 'completed';
    setAutomationState_('ACTIVE', new Date(), diagnostics);

  } finally {

    lock.releaseLock();

  }

}



function setAutomationState_(state, lastRun, diagnostics) {

  try {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss || ss.getId() !== CREW_AUTOMATION.SPREADSHEET_ID) return;

    const sheet = ss.getSheetByName(CREW_AUTOMATION.STATUS_SHEET);

    if (!sheet) return;

    sheet.getRange('A12:B12').setValues([['AppsScriptAutomation', state]]);

    if (lastRun) {

      sheet.getRange('A13:B13').setValues([['AppsScriptLastRun', formatStatusDate_(lastRun)]]);

    }

    sheet.getRange('A14:B14').setValues([['PolicyVersion', 'server-single-source-v5+fingerprint-v3+single-batch-v1']]);
    // Only a completed refresh can attest its actual request path. Installation is not evidence.
    if (lastRun && diagnostics) {
      const fetchMode = diagnostics.fallbackRequests
        ? (diagnostics.batchReceived ? 'single-batch-v1+per-crew-fallback' : 'per-crew-fallback')
        : 'single-batch-v1';
      sheet.getRange('A16:B22').setValues([
        ['FetchMode', fetchMode],
        ['ScriptVersion', CREW_AUTOMATION.SCRIPT_VERSION],
        ['APIBase', CREW_AUTOMATION.API_BASE],
        ['FetchRequestCount', diagnostics.batchRequests + diagnostics.fallbackRequests],
        ['FallbackRequestCount', diagnostics.fallbackRequests],
        ['RunCompletedAt', formatStatusDate_(lastRun)],
        ['RunOutcome', diagnostics.outcome]
      ]);
    }

  } catch (e) {

    // 상태 마커 기록 실패는 본 갱신을 막지 않는다.

  }

}




function crewFingerprintPropertyKey_(crew) {
  // 뉴스 셀은 크루별로 고유하고 ASCII라 PropertiesService 키로 안정적이다.
  const suffix = String((crew && crew.newsCell) || 'unknown')
    .replace(/[^A-Za-z0-9_-]/g, '_');
  return 'CREW_NEWS_FP_' + suffix;
}

function getCrewFingerprint_(crew) {
  return String(
    PropertiesService.getDocumentProperties().getProperty(crewFingerprintPropertyKey_(crew)) || ''
  ).trim();
}

function setCrewFingerprint_(crew, fingerprint) {
  const value = String(fingerprint || '').trim();
  const props = PropertiesService.getDocumentProperties();
  const key = crewFingerprintPropertyKey_(crew);
  if (value) props.setProperty(key, value);
  else props.deleteProperty(key);
}

function clearCrewFingerprint_(crew) {
  PropertiesService.getDocumentProperties().deleteProperty(crewFingerprintPropertyKey_(crew));
}

function clearAllCrewFingerprints_() {
  const props = PropertiesService.getDocumentProperties();
  props.getKeys().forEach(function(key) {
    if (String(key).indexOf('CREW_NEWS_FP_') === 0) props.deleteProperty(key);
  });
}

function assertTargetSpreadsheet_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss || ss.getId() !== CREW_AUTOMATION.SPREADSHEET_ID) {

    throw new Error('이 스크립트는 신생 종겜 크루 멤버 현황 원본 시트에서만 실행해 주세요.');

  }

  return ss;

}



function readCrewConfig_(sheet) {

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];



  const byCrew = {};

  for (let i = 1; i < values.length; i += 1) {

    const row = values[i];

    const crew = String(row[0] || '').trim();

    const member = String(row[2] || '').trim();

    const soopUrl = String(row[3] || '').trim();

    if (!crew || !member || !soopUrl) continue;



    if (!byCrew[crew]) {

      byCrew[crew] = {

        crew: crew,

        newsCell: String(row[4] || '').trim(),

        imageCell: String(row[5] || '').trim(),

        imageRange: String(row[6] || '').trim(),

        color: String(row[9] || CREW_AUTOMATION.COLORS[crew] || '#ffffff').trim(),

        members: []

      };

    }



    byCrew[crew].members.push({

      name: member,

      station: extractStationId_(soopUrl),

      leader: row[1] === true || String(row[1]).toUpperCase() === 'TRUE'

    });

  }



  return Object.keys(byCrew).map(function(key) {

    const crew = byCrew[key];

    crew.members = crew.members.filter(function(member) { return Boolean(member.station); });

    return crew;

  });

}



function readStatusCutoffs_(sheet) {

  const values = sheet.getDataRange().getValues();

  const out = {};

  for (let i = 1; i < values.length; i += 1) {

    const crew = String(values[i][0] || '').trim();

    const publishedAt = String(values[i][4] || '').trim();

    if (crew && publishedAt) out[crew] = publishedAt;

  }

  return out;

}



function refreshOneCrew_(mainSheet, crew, prefetchedPayload, diagnostics) {
  const checkedAt = new Date();
  const newsRange = mainSheet.getRange(crew.newsCell);
  const imageRange = mainSheet.getRange(crew.imageCell);

  const currentText = String(newsRange.getDisplayValue() || '').trim();
  const currentUrl = getCurrentPostUrl_(newsRange);
  const currentFormula = String(imageRange.getFormula() || '');

  const stations = crew.members.map(function(m) { return m.station; });
  const previousFingerprint = getCrewFingerprint_(crew);
  const payload = prefetchedPayload || fetchCrewBatch_(stations, crew, previousFingerprint, diagnostics);
  const serverPolicy = String(payload && payload.policyVersion || '').trim();
  const results = Array.isArray(payload.results) ? payload.results : [];
  const failedStations = results.filter(function(r) { return !r || !r.ok; });
  const selectedFingerprint = String(
    (payload && payload.selectedFingerprint) ||
    (payload && payload.selected && payload.selected.fingerprint) ||
    ''
  ).trim();
  const updateAction = String(payload && payload.updateAction || '').trim();
  const healthStatus = String(payload && payload.healthStatus || '').trim();

  // 서버가 불완전하다고 명시했거나 전체 조회가 실패하면 기존 정상값과 fingerprint를 그대로 둔다.
  if (!payload.ok || payload.preservePrevious === true ||
      (stations.length && failedStations.length === stations.length)) {
    return {
      crew: crew.crew,
      checkedAt: checkedAt,
      changed: false,
      apiFailed: true,
      error: String(payload.error || 'SOOP API 조회 실패'),
      sourceType: '',
      imageState: '기존값 유지',
      writeAction: updateAction || 'preserve_previous',
      fingerprint: previousFingerprint,
      serverPolicy: serverPolicy,
      healthStatus: healthStatus
    };
  }

  // 서버가 대표 후보를 확정한 경우 서버 결과만 사용한다.
  const selected = payload.selected
    ? enrichServerSelected_(payload.selected, results, crew)
    : null;

  if (!selected) {
    // 일부 조회/보조 조회 실패가 있거나 reliableEmpty가 아니면 비우지 않는다.
    const reliableEmpty = payload.complete === true && payload.reliableEmpty === true;
    if (!reliableEmpty) {
      return {
        crew: crew.crew,
        checkedAt: checkedAt,
        changed: false,
        apiFailed: true,
        error: '대표 소식 검증이 완전하지 않아 기존값을 유지했습니다.',
        sourceType: '',
        imageState: '기존값 유지',
        writeAction: updateAction || 'preserve_previous',
        fingerprint: previousFingerprint,
        serverPolicy: serverPolicy,
      healthStatus: healthStatus
      };
    }

    // 모든 조회가 정상 완료됐고 서버가 실제 허용 후보 0건이라고 확정한 경우에만 삭제한다.
    const hadDisplay = Boolean(currentText || currentUrl || currentFormula);
    if (hadDisplay) {
      clearCrewNewsCell_(newsRange);
      clearCrewImage_(mainSheet, crew);
    }
    clearCrewFingerprint_(crew);

    return {
      crew: crew.crew,
      checkedAt: checkedAt,
      successAt: checkedAt,
      changed: hadDisplay,
      apiFailed: false,
      author: '',
      publishedAt: '',
      newsText: '',
      postUrl: '',
      imageUrl: '',
      error: '',
      sourceType: '허용 후보 없음',
      imageState: '이미지 없음',
      selectionReason: '허용 후보 없음',
      imageSelectionReason: '적합 이미지 없음',
      evidenceCount: 0,
      evidenceAuthors: '',
      diagnosticFlag: newestResultPostMs_(results) ? 'new_posts_seen_no_new_event' : 'no_recent_posts',
      writeAction: hadDisplay ? 'clear_no_news' : 'skip_no_news',
      fingerprint: '',
      serverPolicy: serverPolicy,
      healthStatus: healthStatus
    };
  }

  // 핵심: 날짜/제목/활동을 Apps Script에서 다시 계산하지 않는다.
  // 서버가 만든 최종 표시 문자열을 그대로 사용한다.
  const displayText = String(selected.displayText || '').trim();
  if (!displayText) {
    return {
      crew: crew.crew,
      checkedAt: checkedAt,
      changed: false,
      apiFailed: true,
      error: '서버 최종 표시값(displayText)이 없어 기존값을 유지했습니다.',
      sourceType: selected.sourceType || '',
      imageState: '기존값 유지',
      writeAction: 'preserve_previous',
      fingerprint: previousFingerprint,
      serverPolicy: serverPolicy,
      healthStatus: healthStatus
    };
  }

  const samePost = currentUrl &&
    normalizeUrl_(currentUrl) === normalizeUrl_(selected.postUrl);
  const sameText = currentText === displayText;

  const expectedImage = String(selected.sheetImageUrl || '');
  const clearImage = isBlankImageDirective_(selected);
  // blank-image는 실제 대표 이미지가 아니라 이미지 셀을 비우라는 명시적 지시다.
  const imageMatches = clearImage
    ? !currentFormula
    : (expectedImage ? currentFormula.indexOf(expectedImage) !== -1 : true);

  const localMatches = Boolean(samePost && sameText && imageMatches);
  const changed = !localMatches;
  const serverSaysUnchanged =
    payload.shouldWrite === false &&
    payload.unchanged === true &&
    updateAction === 'skip_unchanged';

  // 서버 fingerprint가 같고 실제 시트도 동일하면 뉴스/이미지 셀을 전혀 쓰지 않는다.
  if (serverSaysUnchanged && localMatches) {
    if (selectedFingerprint) setCrewFingerprint_(crew, selectedFingerprint);
    return {
      crew: crew.crew,
      checkedAt: checkedAt,
      successAt: checkedAt,
      changed: false,
      apiFailed: payload.complete !== true,
      author: selected.author || selected.memberName || '',
      publishedAt: selected.sourcePublishedAt || selected.publishedAt || selected.activityDate || '',
      newsText: displayText,
      postUrl: selected.postUrl || '',
      imageUrl: selected.imageUrl || '',
      imageState: clearImage ? '이미지 없음(셀 비움)' : (expectedImage ? '유지(쓰기 생략)' : (currentFormula ? '기존 이미지 유지' : '이미지 없음')),
      error: payload.complete === true ? '' : '일부 조회 실패 - 서버가 확정한 대표 소식만 반영',
      sourceType: selected.sourceType || '',
      selectionReason: selectionReason_(selected),
      imageSelectionReason: imageSelectionReason_(selected),
      evidenceCount: evidenceCount_(selected, crew),
      evidenceAuthors: evidenceAuthors_(selected, crew),
      diagnosticFlag: diagnosticFlag_(selected, results, checkedAt),
      writeAction: 'skip_unchanged',
      fingerprint: selectedFingerprint || previousFingerprint,
      serverPolicy: serverPolicy,
      healthStatus: healthStatus
    };
  }

  // 최초 fingerprint 마이그레이션 등으로 서버가 write를 요청했더라도,
  // 실제 셀이 이미 완전히 동일하면 불필요한 Sheet 쓰기를 생략하고 fingerprint만 저장한다.
  if (!changed) {
    if (selectedFingerprint) setCrewFingerprint_(crew, selectedFingerprint);
    return {
      crew: crew.crew,
      checkedAt: checkedAt,
      successAt: checkedAt,
      changed: false,
      apiFailed: payload.complete !== true,
      author: selected.author || selected.memberName || '',
      publishedAt: selected.sourcePublishedAt || selected.publishedAt || selected.activityDate || '',
      newsText: displayText,
      postUrl: selected.postUrl || '',
      imageUrl: selected.imageUrl || '',
      imageState: clearImage ? '이미지 없음(셀 비움)' : (expectedImage ? '유지(쓰기 생략)' : (currentFormula ? '기존 이미지 유지' : '이미지 없음')),
      error: payload.complete === true ? '' : '일부 조회 실패 - 서버가 확정한 대표 소식만 반영',
      sourceType: selected.sourceType || '',
      selectionReason: selectionReason_(selected),
      imageSelectionReason: imageSelectionReason_(selected),
      evidenceCount: evidenceCount_(selected, crew),
      evidenceAuthors: evidenceAuthors_(selected, crew),
      diagnosticFlag: diagnosticFlag_(selected, results, checkedAt),
      writeAction: updateAction === 'write' ? 'skip_local_unchanged' : (updateAction || 'skip_local_unchanged'),
      fingerprint: selectedFingerprint || previousFingerprint,
      serverPolicy: serverPolicy,
      healthStatus: healthStatus
    };
  }

  // 서버가 unchanged라고 했는데 사용자가 셀을 수정했거나 서식/링크/이미지가 달라진 경우에는
  // 서버의 canonical 값으로 1회 복구한다.
  writeCrewNewsCell_(
    newsRange,
    crew.crew,
    crew.color,
    displayText,
    selected.postUrl
  );

  if (clearImage && currentFormula) {
    clearCrewImage_(mainSheet, crew);
  } else if (expectedImage && !imageMatches) {
    writeCrewImage_(mainSheet, crew, selected);
  }

  // 실제 Sheet 쓰기가 성공한 뒤에만 fingerprint를 전진시켜 실패 시 다음 실행에서 재시도한다.
  if (selectedFingerprint) setCrewFingerprint_(crew, selectedFingerprint);

  return {
    crew: crew.crew,
    checkedAt: checkedAt,
    successAt: checkedAt,
    changed: true,
    apiFailed: payload.complete !== true,
    author: selected.author || selected.memberName || '',
    // 상태 시트는 실제 원문 업로드 시각(sourcePublishedAt)을 기록하고, 메인 소식의 날짜는 displayText/activityDate에 맡긴다.
    publishedAt: selected.sourcePublishedAt || selected.publishedAt || selected.activityDate || '',
    newsText: displayText,
    postUrl: selected.postUrl || '',
    imageUrl: selected.imageUrl || '',
    imageState: clearImage
      ? (currentFormula ? '이미지 삭제' : '이미지 없음(셀 비움)')
      : (expectedImage
        ? (imageMatches ? '유지' : '갱신')
        : (currentFormula ? '기존 이미지 유지' : '이미지 없음')),
    error: payload.complete === true
      ? ''
      : '일부 조회 실패 - 서버가 확정한 대표 소식만 반영',
    sourceType: selected.sourceType || '',
    selectionReason: selectionReason_(selected),
      imageSelectionReason: imageSelectionReason_(selected),
      evidenceCount: evidenceCount_(selected, crew),
      evidenceAuthors: evidenceAuthors_(selected, crew),
      diagnosticFlag: diagnosticFlag_(selected, results, checkedAt),
      writeAction: serverSaysUnchanged ? 'repair_local_drift' : (updateAction || 'write'),
    fingerprint: selectedFingerprint,
    serverPolicy: serverPolicy,
      healthStatus: healthStatus
  };
}

function fetchAllCrewBatches_(crews, diagnostics) {
  const requests = (crews || []).map(function(crew) {
    return {
      crew: crew.crew,
      stations: crew.members.map(function(member) { return member.station; }),
      previousFingerprint: getCrewFingerprint_(crew)
    };
  });

  if (diagnostics) diagnostics.batchRequests += 1;
  const response = UrlFetchApp.fetch(CREW_AUTOMATION.API_BASE + '/api/crew-news-all', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      per_page: CREW_AUTOMATION.FETCH_PER_PAGE,
      crews: requests
    }),
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Accept: 'application/json' }
  });

  const code = response.getResponseCode();
  let envelope = null;
  try {
    envelope = JSON.parse(response.getContentText());
  } catch (e) {
    throw new Error('통합 크루 소식 응답 파싱 실패 (' + code + ')');
  }

  if (code < 200 || code >= 300 || !envelope || !Array.isArray(envelope.batches)) {
    throw new Error('통합 크루 소식 API 오류 (' + code + ')');
  }

  const out = {};
  envelope.batches.forEach(function(row) {
    if (!row || !row.crew || !row.payload) return;
    out[String(row.crew)] = row.payload;
  });
  return out;
}


function fetchCrewBatch_(stations, crew, previousFingerprint, diagnostics) {
  let url = CREW_AUTOMATION.API_BASE + '/api/crew-news-batch?stations=' +
    encodeURIComponent(stations.join(',')) +
    '&crew=' + encodeURIComponent((crew && crew.crew) || '') +
    '&per_page=' + CREW_AUTOMATION.FETCH_PER_PAGE +
    '&client_policy=crew-automation-v1';

  const previous = String(previousFingerprint || '').trim();
  if (previous) {
    url += '&previous_fingerprint=' + encodeURIComponent(previous);
  }

  if (diagnostics) diagnostics.fallbackRequests += 1;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Accept: 'application/json' }
  });

  const code = response.getResponseCode();
  let payload = null;

  try {
    payload = JSON.parse(response.getContentText());
  } catch (e) {
    throw new Error('SOOP 프록시 응답 파싱 실패 (' + code + ')');
  }

  // 서버가 preservePrevious를 보낸 503도 정상적인 "보존 신호"로 전달한다.
  if (code >= 500 && (!payload || (!payload.results && payload.preservePrevious !== true))) {
    throw new Error('SOOP 프록시 서버 오류 (' + code + ')');
  }

  return payload || {
    ok: false,
    complete: false,
    preservePrevious: true,
    results: []
  };
}

function enrichServerSelected_(selected, results, crew) {
  const out = Object.assign({}, selected);
  let matchedPost = null;

  for (let i = 0; i < results.length && !matchedPost; i += 1) {
    const result = results[i];
    if (!result || !Array.isArray(result.posts)) continue;

    for (let j = 0; j < result.posts.length; j += 1) {
      const post = result.posts[j];
      if (String(post.id || '') === String(selected.id || '')) {
        matchedPost = post;
        break;
      }
    }
  }

  if (matchedPost) {
    out.author = matchedPost.author || '';
    out.memberName = matchedPost.memberName || '';
    out.sourceType = matchedPost.isCrewLeader ? '크루장' : '크루원';
    out.imageUrl = out.imageUrl || matchedPost.imageUrl || '';
    out.sheetImageUrl = out.sheetImageUrl || matchedPost.sheetImageUrl || '';
  } else {
    out.sourceType = selected.isCrewLeader ? '크루장' : '크루원';
  }

  // 서버가 제공하는 canonical 필드만 신뢰한다.
  out.displayText = String(selected.displayText || '').trim();
  out.displayDate = String(selected.displayDate || '').trim();
  out.activityDate = String(selected.activityDate || '').trim();
  out.postUrl = String(selected.postUrl || '').trim();
  out.imageUrl = String(selected.imageUrl || '').trim();
  out.sheetImageUrl = String(selected.sheetImageUrl || '').trim();

  return out;
}



function buildCandidates_(crew, results, now) {

  const memberByStation = {};

  crew.members.forEach(function(member) { memberByStation[member.station] = member; });

  const memberNames = crew.members.map(function(m) { return m.name; });

  const maxAgeMs = CREW_AUTOMATION.MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000;

  const out = [];



  results.forEach(function(result) {

    if (!result || !result.ok || !Array.isArray(result.posts)) return;

    const owner = memberByStation[result.station];



    result.posts.forEach(function(post) {

      if (!post || !post.postUrl || !post.publishedAt) return;

      const published = parseKstDate_(post.publishedAt);

      if (!published) return;

      const publishedMs = published.getTime();

      if (now.getTime() - publishedMs > maxAgeMs) return;



      const isOwnerPost = owner && String(post.authorId || '').toLowerCase() === String(result.station).toLowerCase();

      const sourceType = isOwnerPost ? (owner.leader ? '크루장' : '크루원') : 'SOOP 전체';



      const rel = relevanceScore_(crew.crew, memberNames, post, isOwnerPost);

      if (!rel.accept) return;



      out.push({

        crew: crew.crew,

        station: result.station,

        memberName: owner ? owner.name : '',

        leader: owner ? owner.leader : false,

        sourceType: sourceType,

        priority: sourcePriority_(sourceType),

        contentPriority: rel.contentPriority,

        relevance: rel.score,

        publishedAt: post.publishedAt,

        publishedMs: publishedMs,

        title: String(post.title || '').trim(),

        contents: String(post.contents || '').trim(),

        boardName: String(post.boardName || '').trim(),

        author: String(post.author || '').trim(),

        postUrl: String(post.postUrl || '').trim(),

        imageUrl: String(post.imageUrl || '').trim(),

        sheetImageUrl: String(post.sheetImageUrl || '').trim()

      });

    });

  });



  return out;

}

function relevanceScore_(crewName, memberNames, post, isOwnerPost) {

  const titleRaw = String(post.title || '');

  const bodyRaw = String(post.contents || '');

  const boardRaw = String(post.boardName || '');

  const accessType = String(post.accessType || '');

  const title = normalizeText_(titleRaw);

  const body = normalizeText_(bodyRaw);

  const board = normalizeText_(boardRaw);

  const combined = title + ' ' + body;

  const crewToken = normalizeText_(crewName);



  // 3/4번 항목은 완전 제외: 자유/잡담/일상/이벤트/팬/애청자 계열은

  // 제목에 크루명이 있더라도 후보로 사용하지 않는다.

  const excludedBoard = /자유|잡담|일상|이벤트|event|팬\s*게시판|애청자/i.test(boardRaw) || accessType === 'favorite';

  if (excludedBoard) {

    return { accept: false, score: 0, contentPriority: 99 };

  }



  const crewHitTitle = title.indexOf(crewToken) !== -1;

  const crewHitBody = body.indexOf(crewToken) !== -1;

  const crewHitBoard = board.indexOf(crewToken) !== -1;

  const noticeBoard = /공지|공지사항/i.test(boardRaw);



  const memberHits = memberNames.filter(function(name) {

    const token = normalizeText_(name);

    return token && combined.indexOf(token) !== -1;

  }).length;

  const strongActivity = CREW_AUTOMATION.STRONG_ACTIVITY_TERMS.some(function(term) {

    const token = normalizeText_(term);

    return title.indexOf(token) !== -1 || body.indexOf(token) !== -1;

  });



  // 허용 ①: 제목에 크루명이 직접 있거나, 크루 전용 게시판이면서 본문/제목에

  // 실제 활동 신호가 있는 글. 전용 게시판의 단순 잡담은 여기서 걸러낸다.

  const directCrewNamed = crewHitTitle || (crewHitBoard && (crewHitBody || strongActivity || memberHits >= 1));



  // 허용 ②: 공지/공지사항 게시판에서 크루명이 본문/제목에 존재하고,

  // 실제 크루 활동을 설명하는 글.

  const relevantNotice = noticeBoard && (crewHitTitle || crewHitBody || crewHitBoard) &&

    (strongActivity || crewHitTitle || (crewHitBody && memberHits >= 1));



  const accept = directCrewNamed || relevantNotice;

  if (!accept) return { accept: false, score: 0, contentPriority: 99 };



  let score = 0;

  if (crewHitTitle) score += 240;

  if (crewHitBoard) score += 210;

  if (noticeBoard) score += 170;

  if (crewHitBody) score += 110;

  if (strongActivity) score += 35;

  score += Math.min(memberHits, 4) * 12;

  if (isOwnerPost) score += 10;



  return {

    accept: true,

    score: score,

    contentPriority: directCrewNamed ? 0 : 1

  };

}

function pickBestCandidate_(candidates) {

  if (!candidates.length) return null;

  candidates.sort(function(a, b) {

    // ① 크루명 직접 표기 → ② 공지 관련글. 같은 유형 안에서는 최신 글 우선.

    if (a.contentPriority !== b.contentPriority) return a.contentPriority - b.contentPriority;

    if (b.publishedMs !== a.publishedMs) return b.publishedMs - a.publishedMs;

    if (a.priority !== b.priority) return a.priority - b.priority;

    return b.relevance - a.relevance;

  });

  return candidates[0];

}

function sourcePriority_(sourceType) {

  if (sourceType === '크루장') return 1;

  if (sourceType === '크루원') return 2;

  if (sourceType === '애청자 게시판') return 3;

  return 4;

}



function writeCrewNewsCell_(range, crewName, color, text, linkUrl) {

  const prefix = crewName + ' -';

  const pinIndex = text.lastIndexOf('📌');

  const baseStyle = SpreadsheetApp.newTextStyle()

    .setFontFamily('Gowun Dodum')

    .setFontSize(12)

    .setBold(true)

    .setForegroundColor('#ffffff')

    .setUnderline(false)

    .build();

  const crewStyle = SpreadsheetApp.newTextStyle()

    .setFontFamily('Gowun Dodum')

    .setFontSize(12)

    .setBold(true)

    .setForegroundColor(color || '#ffffff')

    .setUnderline(false)

    .build();

  const pinStyle = SpreadsheetApp.newTextStyle()

    .setFontFamily('Gowun Dodum')

    .setFontSize(12)

    .setBold(true)

    .setForegroundColor('#ffffff')

    .setUnderline(false)

    .build();



  let builder = SpreadsheetApp.newRichTextValue().setText(text);

  if (pinIndex >= 0 && linkUrl) {

    // 링크를 먼저 설정하고 마지막에 스타일을 덮어써야 Google 기본 파란색/밑줄이 남지 않는다.

    builder = builder.setLinkUrl(pinIndex, pinIndex + 2, linkUrl);

  }

  builder = builder

    .setTextStyle(0, text.length, baseStyle)

    .setTextStyle(0, Math.min(prefix.length, text.length), crewStyle);

  if (pinIndex >= 0) {

    builder = builder.setTextStyle(pinIndex, pinIndex + 2, pinStyle);

  }



  range.setRichTextValue(builder.build());

  range.setHorizontalAlignment('center').setVerticalAlignment('middle');

}



function clearCrewNewsCell_(range) {

  range.clearContent();

  range.setHorizontalAlignment('center').setVerticalAlignment('middle');

}



function getCurrentPostUrl_(range) {

  try {

    const rich = range.getRichTextValue();

    if (!rich) return '';

    const direct = rich.getLinkUrl();

    if (direct) return direct;

    const runs = rich.getRuns();

    for (let i = runs.length - 1; i >= 0; i -= 1) {

      const url = runs[i].getLinkUrl();

      if (url) return url;

    }

  } catch (e) {}

  return '';

}



function normalizeUrl_(url) {

  return String(url || '').trim().replace(/\/$/, '');

}

function isBlankImageDirective_(selected) {

  const imageUrl = String(selected && selected.imageUrl || '').trim();

  const sheetImageUrl = String(selected && selected.sheetImageUrl || '').trim();

  return !imageUrl && /\/api\/blank-image(?:[?#]|$)/i.test(sheetImageUrl);

}

function writeCrewImage_(sheet, crew, selected) {

  clearOverGridImagesInRange_(sheet, crew.imageRange || crew.imageCell);

  const cell = sheet.getRange(crew.imageCell);

  cell.clearContent();

  if (selected.sheetImageUrl) {

    cell.setFormula('=IMAGE("' + selected.sheetImageUrl.replace(/"/g, '""') + '",1)');

  }

}



function clearCrewImage_(sheet, crew) {

  clearOverGridImagesInRange_(sheet, crew.imageRange || crew.imageCell);

  sheet.getRange(crew.imageCell).clearContent();

}



function clearOverGridImagesInRange_(sheet, a1) {

  if (!a1) return;

  const target = sheet.getRange(a1);

  const r1 = target.getRow();

  const r2 = r1 + target.getNumRows() - 1;

  const c1 = target.getColumn();

  const c2 = c1 + target.getNumColumns() - 1;



  sheet.getImages().forEach(function(image) {

    try {

      const anchor = image.getAnchorCell();

      const r = anchor.getRow();

      const c = anchor.getColumn();

      if (r >= r1 && r <= r2 && c >= c1 && c <= c2) image.remove();

    } catch (e) {

      // 이미지 객체 하나가 오류여도 나머지 갱신은 계속한다.

    }

  });

}



function writeHeaderTimestamp_(sheet, now) {

  const title = '신생 종겜 크루 현황 시트지';

  const subtitle = '업데이트 시간 (' + Utilities.formatDate(now, CREW_AUTOMATION.TIMEZONE, 'M/d HH시 mm분') + ')';

  const text = title + '\n' + subtitle;



  const titleStyle = SpreadsheetApp.newTextStyle()

    .setFontFamily('Jua')

    .setFontSize(24)

    .setForegroundColor('#ffffff')

    .setUnderline(false)

    .build();

  const subtitleStyle = SpreadsheetApp.newTextStyle()

    .setFontFamily('Jua')

    .setFontSize(15)

    .setForegroundColor('#ffffff')

    .setUnderline(false)

    .build();



  const rich = SpreadsheetApp.newRichTextValue()

    .setText(text)

    .setTextStyle(0, title.length, titleStyle)

    .setTextStyle(title.length + 1, text.length, subtitleStyle)

    .build();



  sheet.getRange(CREW_AUTOMATION.HEADER_CELL)

    .setRichTextValue(rich)

    .setHorizontalAlignment('center')

    .setVerticalAlignment('middle');

}



function selectionReason_(selected) {
  const explicit = String(selected && selected.selectionReason || '').trim();
  if (explicit) return explicit;
  if (selected && (selected.isCrewLeader === true || Number(selected.representativeTier) === 1)) return '크루장 대표';
  if (String(selected && selected.publicVerification || '') === 'event_cluster') return '크루 활동 문맥 일치';
  return '서버 대표 선정';
}

function imageSelectionReason_(selected) {
  const explicit = String(selected && selected.imageSelectionReason || '').trim();
  if (explicit) return explicit;
  const source = String(selected && selected.imageSource || '').trim();
  if (source === 'post_self') return '대표 게시글 이미지';
  if (source === 'post_member') return '같은 이벤트 크루원 이미지';
  if (source === 'leader_vod_same_day') return '같은 날짜 크루장 VOD';
  if (isBlankImageDirective_(selected) || !String(selected && selected.imageUrl || '').trim()) return '적합 이미지 없음';
  return '검증된 대표 이미지';
}

function evidenceAuthors_(selected, crew) {
  let values = [];
  if (selected && Array.isArray(selected.evidenceAuthors)) values = selected.evidenceAuthors.slice();
  if (!values.length && selected && Array.isArray(selected.evidenceStations)) {
    values = selected.evidenceStations.map(function(station) {
      const member = (crew && crew.members || []).filter(function(row) { return String(row.station) === String(station); })[0];
      return member ? member.name : station;
    });
  }
  if (!values.length) {
    const fallback = String(selected && (selected.author || selected.memberName) || '').trim();
    if (fallback) values = [fallback];
  }
  return values.filter(Boolean).filter(function(value, index, array) { return array.indexOf(value) === index; }).join(', ');
}

function evidenceCount_(selected, crew) {
  const explicit = Number(selected && selected.evidenceCount || 0);
  if (explicit > 0) return explicit;
  const authors = evidenceAuthors_(selected, crew);
  return authors ? authors.split(',').length : (selected ? 1 : 0);
}

function newestResultPostMs_(results) {
  let newest = 0;
  (results || []).forEach(function(result) {
    (result && result.posts || []).forEach(function(post) {
      const date = parseKstDate_(post && post.publishedAt || '');
      if (date && date.getTime() > newest) newest = date.getTime();
    });
  });
  return newest;
}

function diagnosticFlag_(selected, results, checkedAt) {
  const flags = [];
  const now = checkedAt instanceof Date ? checkedAt : new Date();
  const eventDate = parseKstDate_(selected && (selected.activityDate || selected.sourcePublishedAt || selected.publishedAt) || '');
  if (eventDate && now.getTime() - eventDate.getTime() >= 14 * 24 * 60 * 60 * 1000) flags.push('stale_14d_plus');
  const selectedPublished = parseKstDate_(selected && (selected.sourcePublishedAt || selected.publishedAt) || '');
  const newestPostMs = newestResultPostMs_(results);
  if (selectedPublished && newestPostMs > selectedPublished.getTime() + 24 * 60 * 60 * 1000) flags.push('new_posts_seen_no_new_event');
  if (selected && (isBlankImageDirective_(selected) || !String(selected.imageUrl || '').trim())) flags.push('image_none');
  return flags.join(', ');
}

function ensureStatusDiagnosticsColumns_(sheet) {
  // E열은 활동일이 아니라 원문 게시글의 실제 업로드 시각을 기록한다.
  if (String(sheet.getRange('E1').getDisplayValue() || '').trim() !== '원문게시일') {
    sheet.getRange('E1').setValue('원문게시일');
  }

  const requiredColumns = 20;
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }

  const expected = ['Fingerprint', 'UpdateAction', 'HealthStatus'];
  const headerRange = sheet.getRange(1, 13, 1, 3);
  const current = headerRange.getDisplayValues()[0];
  const matches = expected.every(function(value, index) { return current[index] === value; });
  if (!matches) {
    sheet.getRange(1, 12).copyTo(headerRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    headerRange.setValues([expected]);
  }

  const diagnosticHeaders = ['대표선정이유', '이미지선정이유', '근거수', '근거작성자', '진단플래그'];
  const diagnosticHeaderRange = sheet.getRange(1, 16, 1, 5);
  const diagnosticCurrent = diagnosticHeaderRange.getDisplayValues()[0];
  const diagnosticMatches = diagnosticHeaders.every(function(value, index) { return diagnosticCurrent[index] === value; });
  if (!diagnosticMatches) {
    sheet.getRange(1, 15).copyTo(diagnosticHeaderRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    diagnosticHeaderRange.setValues([diagnosticHeaders]);
  }
}

function writeStatus_(sheet, results) {

  ensureStatusDiagnosticsColumns_(sheet);

  const current = sheet.getDataRange().getValues();

  const rowByCrew = {};

  for (let i = 1; i < current.length; i += 1) {

    const crew = String(current[i][0] || '').trim();

    if (crew) rowByCrew[crew] = i + 1;

  }



  results.forEach(function(result) {

    const row = rowByCrew[result.crew];

    if (!row) return;

    const old = sheet.getRange(row, 1, 1, 20).getValues()[0];

    const checked = formatStatusDate_(result.checkedAt || new Date());

    const success = result.successAt ? formatStatusDate_(result.successAt) : (old[2] || '');

    const has = function(key) { return Object.prototype.hasOwnProperty.call(result, key); };



    sheet.getRange(row, 1, 1, 20).setValues([[

      result.crew,

      checked,

      success,

      has('author') ? result.author : (old[3] || ''),

      has('publishedAt') ? result.publishedAt : (old[4] || ''),

      has('newsText') ? result.newsText : (old[5] || ''),

      has('postUrl') ? result.postUrl : (old[6] || ''),

      has('imageUrl') ? result.imageUrl : (old[7] || ''),

      result.imageState || '',

      result.error || '',

      result.sourceType || '',

      '10분',

      has('fingerprint') ? result.fingerprint : (old[12] || ''),

      has('writeAction') ? result.writeAction : (old[13] || ''),

      has('healthStatus') ? result.healthStatus : (old[14] || ''),
      has('selectionReason') ? result.selectionReason : (old[15] || ''),
      has('imageSelectionReason') ? result.imageSelectionReason : (old[16] || ''),
      has('evidenceCount') ? result.evidenceCount : (old[17] || ''),
      has('evidenceAuthors') ? result.evidenceAuthors : (old[18] || ''),
      has('diagnosticFlag') ? result.diagnosticFlag : (old[19] || '')

    ]]);

  });

  const policies = [];
  results.forEach(function(result) {
    const policy = String(result && result.serverPolicy || '').trim();
    if (policy && policies.indexOf(policy) === -1) policies.push(policy);
  });
  if (policies.length) {
    sheet.getRange('A15:B15').setValues([['ServerPolicy', policies.join(', ')]]);
  }

}

function summarizePostTitle_(crewName, title, contents, boardName) {

  let text = String(title || '').replace(/\s+/g, ' ').trim();

  const body = String(contents || '').replace(/\s+/g, ' ').trim();

  const board = String(boardName || '').trim();



  // 날짜+오늘/공지, 오늘, 오뱅/오뱅공 계열처럼 제목만으로 내용을 알 수 없는 경우를

  // 모두 의미 약한 제목으로 본다. 괄호가 뒤에 붙어도 generic으로 처리한다.

  const isGeneric = !text ||

    /^\d{6}\s*(?:오늘|공지|방송|일정)(?:\b|\s|\(|\[|$)/i.test(text) ||

    /^(?:오늘|오뱅|오뱅공|공지)(?:\b|\s|\(|\[|:|-|$)/i.test(text) ||

    CREW_AUTOMATION.GENERIC_TITLE_PATTERNS.some(function(pattern) { return pattern.test(text); });



  if (isGeneric) {

    const activityPattern = '(정기\\\s*회의|비방\\\s*회의|회의|중계\\\s*합방|종겜\\\s*합방|합방|메이드\\\s*카페|모캡\\\s*합방|모집|면접|합격|영입|가입|탈퇴|행사|대회|회식|여행|모임|콘텐츠|컨텐츠)';

    const escapedCrew = escapeRegExp_(crewName);



    // 가장 선호: 본문에 '크루명 + 실제 활동'이 직접 쓰여 있는 경우.

    let match = body.match(new RegExp(escapedCrew + '[^.!?\\\n]{0,24}?' + activityPattern, 'i'));

    if (match) {

      return (crewName + ' ' + match[1]).replace(/\s+/g, ' ').trim();

    }



    // 공지/크루 전용 게시판에서는 활동명이 명확하면 크루명과 결합한다.

    match = body.match(new RegExp(activityPattern, 'i'));

    if (match && (/공지|공지사항/i.test(board) || normalizeText_(board).indexOf(normalizeText_(crewName)) !== -1 || normalizeText_(body).indexOf(normalizeText_(crewName)) !== -1)) {

      return (crewName + ' ' + match[1]).replace(/\s+/g, ' ').trim();

    }



    return crewName + ' 소식';

  }



  if (!text) return crewName + ' 소식';

  text = text.replace(/^\[[^\]]+\]\s*/, '');

  text = text.replace(new RegExp('^' + escapeRegExp_(crewName) + '(?:\\\)|\\\]|：|:|-|\\\s)*', 'i'), '');

  text = text.trim();



  if (!text || /^(?:\d{6}\s*)?(?:오늘|공지|오뱅공?|방송|일정)$/i.test(text)) {

    return crewName + ' 소식';

  }



  if (text.length > 28) text = text.slice(0, 27).trim() + '…';

  return text;

}

function parseCurrentNewsDate_(text, now) {

  const match = String(text || '').match(/\((\d{1,2})\/(\d{1,2})\)/);

  if (!match) return null;

  const month = Number(match[1]);

  const day = Number(match[2]);

  const year = Number(Utilities.formatDate(now, CREW_AUTOMATION.TIMEZONE, 'yyyy'));

  let date = new Date(Date.UTC(year, month - 1, day, -9, 0, 0));

  if (date.getTime() > now.getTime() + 31 * 24 * 60 * 60 * 1000) {

    date = new Date(Date.UTC(year - 1, month - 1, day, -9, 0, 0));

  }

  return date;

}



function parseKstDate_(value) {

  const text = String(value || '').trim();

  const match = text.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})(?:[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);

  if (!match) {

    const fallback = new Date(text);

    return isNaN(fallback.getTime()) ? null : fallback;

  }

  return new Date(Date.UTC(

    Number(match[1]), Number(match[2]) - 1, Number(match[3]),

    Number(match[4] || 0) - 9, Number(match[5] || 0), Number(match[6] || 0)

  ));

}



function formatEventDate_(selected) {

  const published = parseKstDate_(selected.publishedAt) || new Date();

  const text = String(selected.title || '') + ' ' + String(selected.contents || '');



  let match = text.match(/(?:^|[^0-9])(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:[^0-9]|$)/);

  if (match) {

    const month = Number(match[1]);

    const day = Number(match[2]);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return month + '/' + day;

  }



  match = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);

  if (match) {

    const month = Number(match[1]);

    const day = Number(match[2]);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return month + '/' + day;

  }



  if (/내일/.test(text)) {

    const tomorrow = new Date(published.getTime() + 24 * 60 * 60 * 1000);

    return Utilities.formatDate(tomorrow, CREW_AUTOMATION.TIMEZONE, 'M/d');

  }



  const hasActivity = CREW_AUTOMATION.ACTIVITY_TERMS.some(function(term) {

    return text.indexOf(term) !== -1;

  });

  if (hasActivity) {

    match = text.match(/(?:^|[^0-9])(\d{1,2})\s*일(?:\s|에|날|합방|회의|모임|일정|행사|대회|출발|진행|예정|$)/);

    if (match) {

      const day = Number(match[1]);

      if (day >= 1 && day <= 31) {

        const month = Number(Utilities.formatDate(published, CREW_AUTOMATION.TIMEZONE, 'M'));

        return month + '/' + day;

      }

    }

  }



  return Utilities.formatDate(published, CREW_AUTOMATION.TIMEZONE, 'M/d');

}



function formatPostDate_(value) {

  const date = parseKstDate_(value);

  return date ? Utilities.formatDate(date, CREW_AUTOMATION.TIMEZONE, 'M/d') : Utilities.formatDate(new Date(), CREW_AUTOMATION.TIMEZONE, 'M/d');

}



function formatStatusDate_(date) {

  return Utilities.formatDate(date, CREW_AUTOMATION.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

}



function normalizeText_(value) {

  return String(value || '')

    .toLowerCase()

    .replace(/<[^>]+>/g, ' ')

    .replace(/[\s\u200b\u00a0]+/g, '')

    .replace(/[\[\](){}<>「」『』“”'".,!?~·:;_\-]/g, '');

}



function extractStationId_(url) {

  const text = String(url || '').trim();

  let match = text.match(/\/station\/([^/?#]+)/i);

  if (match) return match[1];

  match = text.match(/(?:ch\.)?sooplive\.(?:com|co\.kr)\/([^/?#]+)/i);

  return match ? match[1] : '';

}



function escapeRegExp_(value) {

  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

}
