/**
 * 크루 소식 자동화 v1.8 보조 실행본
 *
 * 기존 Code.gs(v1.7.x)의 검증된 수집/표시 로직을 재사용하면서 다음 보호 계층만 추가한다.
 * - 숨김 `자동화 제어`: 자동 / 임시 고정 / 영구 고정
 * - 숨김 `자동화 판정 이력`: 서버 candidateAudit 변경분 누적
 * - 빈칸 삭제: 서버 clearVerified까지 확인된 경우에만 허용
 *
 * 설치: Apps Script 프로젝트에 이 파일을 추가한 뒤 installCrewNewsAutomationV180() 1회 실행.
 */

const CREW_AUTOMATION_V180 = Object.freeze({
  SCRIPT_VERSION: 'crew-apps-script-v1.8.0',
  CONTROL_SHEET: '자동화 제어',
  AUDIT_SHEET: '자동화 판정 이력',
  MAX_AUDIT_ROWS: 2000
});

function onOpenCrewNewsV180() {
  SpreadsheetApp.getUi()
    .createMenu('크루 자동화 v1.8')
    .addItem('지금 안전 갱신', 'refreshCrewNewsV180')
    .addItem('v1.8 자동갱신 재설치', 'installCrewNewsAutomationV180')
    .addItem('v1.8 자동갱신 제거', 'uninstallCrewNewsAutomationV180')
    .addToUi();
}

function installCrewNewsAutomationV180() {
  const ss = assertTargetSpreadsheet_();
  const controlSheet = ss.getSheetByName(CREW_AUTOMATION_V180.CONTROL_SHEET);
  const auditSheet = ss.getSheetByName(CREW_AUTOMATION_V180.AUDIT_SHEET);
  if (!controlSheet || !auditSheet) {
    throw new Error('자동화 제어/자동화 판정 이력 시트가 없습니다. 숨김 운영 탭을 먼저 확인해 주세요.');
  }

  removeCrewNewsV180Triggers_(true);
  ScriptApp.newTrigger('refreshCrewNewsV180')
    .timeBased()
    .everyMinutes(CREW_AUTOMATION.TRIGGER_MINUTES)
    .create();
  ScriptApp.newTrigger('onOpenCrewNewsV180')
    .forSpreadsheet(ss)
    .onOpen()
    .create();

  PropertiesService.getDocumentProperties().setProperties({
    CREW_AUTOMATION_INSTALLED: 'true',
    CREW_AUTOMATION_INTERVAL: String(CREW_AUTOMATION.TRIGGER_MINUTES),
    CREW_AUTOMATION_INSTALLED_AT: new Date().toISOString(),
    CREW_AUTOMATION_SCRIPT_VERSION: CREW_AUTOMATION_V180.SCRIPT_VERSION
  }, true);

  clearAllCrewFingerprints_();
  setAutomationState_('ACTIVE');
  onOpenCrewNewsV180();
  refreshCrewNewsV180();
}

function uninstallCrewNewsAutomationV180() {
  removeCrewNewsV180Triggers_(false);
  const props = PropertiesService.getDocumentProperties();
  props.deleteProperty('CREW_AUTOMATION_INSTALLED');
  props.deleteProperty('CREW_AUTOMATION_INTERVAL');
  props.deleteProperty('CREW_AUTOMATION_INSTALLED_AT');
  props.deleteProperty('CREW_AUTOMATION_SCRIPT_VERSION');
  clearAllCrewFingerprints_();
  setAutomationState_('INACTIVE');
}

function removeCrewNewsV180Triggers_(includeLegacy) {
  const handlers = includeLegacy
    ? { refreshCrewNews: true, refreshCrewNewsV180: true, onOpenCrewNewsV180: true }
    : { refreshCrewNewsV180: true, onOpenCrewNewsV180: true };

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers[trigger.getHandlerFunction()]) ScriptApp.deleteTrigger(trigger);
  });
}

function refreshCrewNewsV180() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  const startedAt = new Date();
  try {
    const ss = assertTargetSpreadsheet_();
    const main = ss.getSheetByName(CREW_AUTOMATION.MAIN_SHEET);
    const configSheet = ss.getSheetByName(CREW_AUTOMATION.CONFIG_SHEET);
    const statusSheet = ss.getSheetByName(CREW_AUTOMATION.STATUS_SHEET);
    const controlSheet = ss.getSheetByName(CREW_AUTOMATION_V180.CONTROL_SHEET);
    const auditSheet = ss.getSheetByName(CREW_AUTOMATION_V180.AUDIT_SHEET);

    if (!main || !configSheet || !statusSheet || !controlSheet || !auditSheet) {
      throw new Error('메인/설정/상태/제어/판정 이력 시트를 모두 확인해 주세요.');
    }

    const crews = readCrewConfig_(configSheet);
    const controls = readCrewControls_(controlSheet);
    const validation = validateCrewConfigAndMain_(main, crews);
    const runResults = [];
    let hardFailure = false;

    const diagnostics = {
      batchRequests: 0,
      fallbackRequests: 0,
      batchReceived: false,
      soopMetrics: emptySoopMetrics_(),
      auditPayloads: {}
    };

    let batchPayloads = {};
    try {
      batchPayloads = fetchAllCrewBatches_(crews, diagnostics);
      diagnostics.batchReceived = true;
    } catch (batchError) {
      batchPayloads = {};
    }

    crews.forEach(function(crew) {
      try {
        const result = refreshOneCrewV180_(
          main,
          crew,
          batchPayloads[crew.crew] || null,
          diagnostics,
          controls[crew.crew] || null
        );
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
          imageState: '오류',
          writeAction: 'v180_error'
        });
      }
    });

    writeStatus_(statusSheet, runResults);
    applyCrewControlUpdates_(controlSheet, controls);
    appendCandidateAuditBatch_(auditSheet, diagnostics.auditPayloads, startedAt);

    if (!hardFailure && runResults.length === crews.length) {
      writeHeaderTimestamp_(main, new Date());
    }

    diagnostics.outcome = hardFailure ? 'completed_with_errors' : 'completed';
    setAutomationState_('ACTIVE', new Date(), diagnostics);
    writeOperatorSummary_(statusSheet, crews, runResults, validation, diagnostics);
    writeV180Status_(statusSheet);
  } finally {
    lock.releaseLock();
  }
}

function refreshOneCrewV180_(mainSheet, crew, prefetchedPayload, diagnostics, control) {
  const checkedAt = new Date();
  const newsRange = mainSheet.getRange(crew.newsCell);
  const currentText = String(newsRange.getDisplayValue() || '').trim();
  const currentUrl = getCurrentPostUrl_(newsRange);
  const stations = crew.members.map(function(member) { return member.station; });
  const previousFingerprint = getCrewFingerprint_(crew);
  const payload = prefetchedPayload || fetchCrewBatch_(stations, crew, previousFingerprint, diagnostics);

  if (diagnostics) {
    if (!diagnostics.auditPayloads) diagnostics.auditPayloads = {};
    diagnostics.auditPayloads[crew.crew] = payload;
  }

  const controlDecision = resolveManualControl_(control, payload, currentUrl, checkedAt);
  if (control && controlDecision.capture) {
    control.lockedUrl = controlDecision.lockedUrl || currentUrl || '';
    control.lockedAt = controlDecision.lockedAt || checkedAt.toISOString();
    control.dirty = true;
  }
  if (control && controlDecision.release) {
    control.mode = '자동';
    control.lockedUrl = '';
    control.lockedAt = '';
    control.dirty = true;
  }
  if (controlDecision.preserve) {
    return protectedResultV180_(
      crew,
      checkedAt,
      payload,
      previousFingerprint,
      currentText,
      currentUrl,
      controlDecision.reason,
      normalizeControlMode_(control && control.mode) === '영구 고정'
        ? 'manual_lock_permanent'
        : 'manual_lock_temporary',
      false
    );
  }

  if (payload && payload.ok === true && !payload.selected && !isVerifiedClearPayload_(payload)) {
    return protectedResultV180_(
      crew,
      checkedAt,
      payload,
      previousFingerprint,
      currentText,
      currentUrl,
      '서버의 전체 후보 재평가·0건 증명이 없어 빈칸 처리를 차단했습니다.',
      'clear_blocked_unverified',
      true
    );
  }

  return refreshOneCrew_(mainSheet, crew, payload, diagnostics);
}

function protectedResultV180_(crew, checkedAt, payload, fingerprint, currentText, currentUrl, reason, action, forceError) {
  const selected = payload && payload.selected || {};
  const apiOk = Boolean(payload && payload.ok === true);
  return {
    crew: crew.crew,
    checkedAt: checkedAt,
    successAt: apiOk ? checkedAt : '',
    changed: false,
    apiFailed: forceError === true || !apiOk,
    author: selected.author || selected.memberName || '',
    publishedAt: selected.sourcePublishedAt || selected.publishedAt || selected.activityDate || '',
    newsText: currentText || '',
    postUrl: currentUrl || '',
    imageUrl: '',
    error: forceError === true
      ? reason
      : (apiOk ? '' : String(payload && payload.error || 'SOOP API 조회 실패')),
    sourceType: action.indexOf('manual_lock_') === 0 ? '수동 보호' : '안전 보호',
    imageState: '기존값 유지',
    selectionReason: reason,
    imageSelectionReason: '기존 이미지 유지',
    evidenceCount: 0,
    evidenceAuthors: '',
    diagnosticFlag: action,
    writeAction: action,
    fingerprint: fingerprint || '',
    serverPolicy: String(payload && payload.policyVersion || ''),
    healthStatus: String(payload && payload.healthStatus || '')
  };
}

function normalizeControlMode_(value) {
  const mode = String(value || '').trim();
  return mode === '임시 고정' || mode === '영구 고정' ? mode : '자동';
}

function readCrewControls_(sheet) {
  const out = {};
  if (!sheet) return out;
  const values = sheet.getDataRange().getValues();
  const props = PropertiesService.getDocumentProperties();

  for (let i = 1; i < values.length; i += 1) {
    const crew = String(values[i][0] || '').trim();
    if (!crew) continue;
    const mode = normalizeControlMode_(values[i][1]);
    const lockedAtValue = values[i][3];
    const lockedAt = lockedAtValue instanceof Date
      ? lockedAtValue.toISOString()
      : String(lockedAtValue || '').trim();
    const lastMode = String(props.getProperty(controlModePropertyKey_(crew)) || '').trim();
    out[crew] = {
      row: i + 1,
      crew: crew,
      mode: mode,
      lockedUrl: String(values[i][2] || '').trim(),
      lockedAt: lockedAt,
      note: String(values[i][4] || '').trim(),
      modeChanged: Boolean(lastMode && lastMode !== mode),
      dirty: false
    };
  }
  return out;
}

function controlModePropertyKey_(crew) {
  return 'CREW_CONTROL_MODE_' + String(crew || '').replace(/\s+/g, '_');
}

function applyCrewControlUpdates_(sheet, controls) {
  if (!sheet || !controls) return;
  const props = PropertiesService.getDocumentProperties();
  Object.keys(controls).forEach(function(crew) {
    const control = controls[crew];
    if (!control) return;
    if (control.dirty && control.row > 1) {
      sheet.getRange(control.row, 2, 1, 3).setValues([[
        normalizeControlMode_(control.mode),
        String(control.lockedUrl || ''),
        String(control.lockedAt || '')
      ]]);
      control.dirty = false;
    }
    props.setProperty(controlModePropertyKey_(crew), normalizeControlMode_(control.mode));
  });
}

function controlTimestampMs_(value) {
  if (value instanceof Date) return value.getTime();
  const raw = String(value || '').trim();
  if (!raw) return 0;
  let normalized = raw;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
    normalized = raw.replace(/\s+/, 'T') + '+09:00';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    normalized = raw + 'T00:00:00+09:00';
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectedTimestampMsV180_(payload) {
  const selected = payload && payload.selected || {};
  return controlTimestampMs_(
    selected.sourcePublishedAt || selected.publishedAt || selected.activityDate || ''
  );
}

function normalizeControlUrlV180_(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function resolveManualControl_(control, payload, currentUrl, checkedAt) {
  const mode = normalizeControlMode_(control && control.mode);
  if (mode === '자동') {
    return { preserve: false, release: false, capture: false, reason: '' };
  }

  const now = checkedAt instanceof Date ? checkedAt : new Date();
  const baselineUrl = String(control && control.lockedUrl || currentUrl || '').trim();
  const baselineAt = String(control && control.lockedAt || '').trim();
  const needsCapture = Boolean(control && control.modeChanged) || !baselineAt;

  if (normalizeControlMode_(control.mode) === '영구 고정') {
    return {
      preserve: true,
      release: false,
      capture: needsCapture,
      lockedUrl: needsCapture ? String(currentUrl || baselineUrl || '') : baselineUrl,
      lockedAt: needsCapture ? now.toISOString() : baselineAt,
      reason: '영구 고정: 운영자가 자동 덮어쓰기를 해제할 때까지 현재 소식을 유지합니다.'
    };
  }

  if (needsCapture) {
    return {
      preserve: true,
      release: false,
      capture: true,
      lockedUrl: String(currentUrl || baselineUrl || ''),
      lockedAt: now.toISOString(),
      reason: '임시 고정 기준을 현재 소식으로 저장했습니다.'
    };
  }

  const selected = payload && payload.selected || null;
  if (!selected) {
    return {
      preserve: true,
      release: false,
      capture: false,
      reason: '임시 고정: 더 최신의 다른 적합 소식이 확인될 때까지 현재 소식을 유지합니다.'
    };
  }

  const selectedUrl = normalizeControlUrlV180_(selected.postUrl);
  const lockedUrl = normalizeControlUrlV180_(baselineUrl);
  const selectedMs = selectedTimestampMsV180_(payload);
  const lockedMs = controlTimestampMs_(baselineAt);
  const genuinelyNewer = Boolean(
    selectedUrl &&
    selectedUrl !== lockedUrl &&
    selectedMs > 0 &&
    lockedMs > 0 &&
    selectedMs > lockedMs
  );

  if (genuinelyNewer) {
    return {
      preserve: false,
      release: true,
      capture: false,
      reason: '임시 고정 이후의 더 최신 적합 소식이 확인되어 자동 모드로 복귀합니다.'
    };
  }

  return {
    preserve: true,
    release: false,
    capture: false,
    reason: '임시 고정: 기존 소식보다 확실히 최신인 다른 적합 소식이 없어 현재 값을 유지합니다.'
  };
}

function isVerifiedClearPayload_(payload) {
  return Boolean(
    payload &&
    payload.ok === true &&
    payload.complete === true &&
    payload.healthStatus === 'healthy' &&
    payload.preservePrevious !== true &&
    payload.reliableEmpty === true &&
    payload.clearVerified === true &&
    payload.candidateAuditComplete === true &&
    Number(payload.eligibleCandidateCount || 0) === 0 &&
    Number(payload.failed || 0) === 0 &&
    Number(payload.auxiliaryFailed || 0) === 0
  );
}

function auditHashV180_(text) {
  const value = String(text || '');
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function auditSignatureV180_(payload) {
  const audit = Array.isArray(payload && payload.candidateAudit) ? payload.candidateAudit : [];
  return auditHashV180_(JSON.stringify({
    version: String(payload && payload.candidateAuditVersion || ''),
    selectedFingerprint: String(payload && payload.selectedFingerprint || ''),
    clearVerified: Boolean(payload && payload.clearVerified),
    audit: audit.map(function(row) {
      return [row.decision, row.id, row.publishedAt, row.activity, row.reason, row.postUrl];
    })
  }));
}

function auditPropertyKeyV180_(crew) {
  return 'CREW_AUDIT_SIG_' + String(crew || '').replace(/\s+/g, '_');
}

function appendCandidateAuditBatch_(sheet, payloads, startedAt) {
  if (!sheet || !payloads) return 0;
  const rows = [];
  const signatures = {};
  const props = PropertiesService.getDocumentProperties();
  const recordedAt = Utilities.formatDate(
    startedAt instanceof Date ? startedAt : new Date(),
    CREW_AUTOMATION.TIMEZONE,
    'yyyy-MM-dd HH:mm:ss'
  );

  Object.keys(payloads).forEach(function(crew) {
    const payload = payloads[crew];
    const audit = Array.isArray(payload && payload.candidateAudit) ? payload.candidateAudit : [];
    if (!audit.length) return;

    const propertyKey = auditPropertyKeyV180_(crew);
    const signature = auditSignatureV180_(payload);
    if (signature && props.getProperty(propertyKey) === signature) return;

    audit.slice(0, 10).forEach(function(entry) {
      const selected = payload && payload.selected || {};
      const sameSelected = String(entry && entry.id || '') === String(selected.id || '');
      rows.push([
        recordedAt,
        crew,
        String(entry && entry.decision || ''),
        String(entry && entry.id || ''),
        String(entry && entry.author || ''),
        String(entry && entry.publishedAt || ''),
        String(entry && entry.activity || ''),
        String(entry && entry.reason || ''),
        String(entry && entry.postUrl || ''),
        String(entry && entry.imageSource || (sameSelected ? selected.imageSource : '') || ''),
        String(payload && payload.updateAction || ''),
        String(payload && payload.selectedFingerprint || selected.fingerprint || '')
      ]);
    });

    if (signature) signatures[propertyKey] = signature;
  });

  if (!rows.length) return 0;

  const startRow = Math.max(2, sheet.getLastRow() + 1);
  const requiredLastRow = startRow + rows.length - 1;
  if (requiredLastRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredLastRow - sheet.getMaxRows());
  }
  sheet.getRange(startRow, 1, rows.length, 12).setValues(rows);

  Object.keys(signatures).forEach(function(key) {
    props.setProperty(key, signatures[key]);
  });

  const dataRows = Math.max(0, sheet.getLastRow() - 1);
  const overflow = dataRows - CREW_AUTOMATION_V180.MAX_AUDIT_ROWS;
  if (overflow > 0) sheet.deleteRows(2, overflow);
  return rows.length;
}

function writeV180Status_(statusSheet) {
  if (!statusSheet) return;
  statusSheet.getRange('A14:B14').setValues([[
    'PolicyVersion',
    'server-single-source-v5+fingerprint-v3+single-batch-v1+candidate-audit-v1+control-v1'
  ]]);
  statusSheet.getRange('A17:B17').setValues([['ScriptVersion', CREW_AUTOMATION_V180.SCRIPT_VERSION]]);
  statusSheet.getRange('G21:H22').setValues([
    ['ControlSheet', CREW_AUTOMATION_V180.CONTROL_SHEET],
    ['CandidateAudit', 'candidate-audit-v1']
  ]);
}
