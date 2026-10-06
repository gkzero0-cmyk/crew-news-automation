/**
 * 크루 소식 자동화 v1.8.2 - 10분 트리거 + 대표정책 동기화
 *
 * 기존 Code.gs + ControlAuditV180.gs + StyleSelfHealV181.gs를 그대로 사용한다.
 * installCrewNewsPolicySyncV182()을 1회 실행하면 기존 v1.8/v1.8.1 트리거를 제거하고
 * refreshCrewNewsV182() 하나를 10분 주기로 설치한다.
 */

const CREW_POLICY_SYNC_V182 = Object.freeze({
  SCRIPT_VERSION: 'crew-apps-script-v1.8.2',
  TRIGGER_HANDLER: 'refreshCrewNewsV182',
  TRIGGER_MINUTES: 10,
  SERVER_POLICY: 'representative-v6.5-server'
});

function installCrewNewsPolicySyncV182() {
  assertTargetSpreadsheet_();
  const handlers = {
    refreshCrewNews: true,
    refreshCrewNewsV180: true,
    refreshCrewNewsV181: true,
    refreshCrewNewsV182: true
  };
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers[trigger.getHandlerFunction()]) ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('refreshCrewNewsV182')
    .timeBased()
    .everyMinutes(CREW_POLICY_SYNC_V182.TRIGGER_MINUTES)
    .create();

  const props = PropertiesService.getDocumentProperties();
  props.setProperties({
    CREW_AUTOMATION_INTERVAL: String(CREW_POLICY_SYNC_V182.TRIGGER_MINUTES),
    CREW_AUTOMATION_SCRIPT_VERSION: CREW_POLICY_SYNC_V182.SCRIPT_VERSION
  }, false);

  refreshCrewNewsV182();
}

function uninstallCrewNewsPolicySyncV182() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === CREW_POLICY_SYNC_V182.TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function refreshCrewNewsV182() {
  refreshCrewNewsV181();
  const ss = assertTargetSpreadsheet_();
  const statusSheet = ss.getSheetByName(CREW_AUTOMATION.STATUS_SHEET);
  if (!statusSheet) throw new Error('자동화 상태 시트를 확인해 주세요.');
  writePolicySyncStatusV182_(statusSheet);
}

function writePolicySyncStatusV182_(statusSheet) {
  const values = statusSheet.getDataRange().getValues();
  const replacements = {
    ScriptVersion: CREW_POLICY_SYNC_V182.SCRIPT_VERSION,
    AutomationInterval: CREW_POLICY_SYNC_V182.TRIGGER_MINUTES + '분'
  };
  Object.keys(replacements).forEach(function(label) {
    let found = false;
    for (let i = 0; i < values.length; i += 1) {
      if (String(values[i][0] || '').trim() === label) {
        statusSheet.getRange(i + 1, 2).setValue(replacements[label]);
        found = true;
        break;
      }
    }
    if (!found) {
      statusSheet.appendRow([label, replacements[label]]);
    }
  });
}
