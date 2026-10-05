/**
 * 크루 소식 자동화 v1.8.1 - 크루명 색상 자가복구
 *
 * 기존 Code.gs + ControlAuditV180.gs를 그대로 사용한다.
 * refreshCrewNewsV181()은 기존 v1.8 갱신을 먼저 실행한 뒤,
 * 크루 소식 셀의 크루명 색상만 검사하고 틀린 경우에만 복구한다.
 */

const CREW_STYLE_SELF_HEAL_V181 = Object.freeze({
  SCRIPT_VERSION: 'crew-apps-script-v1.8.1',
  TRIGGER_HANDLER: 'refreshCrewNewsV181'
});

function installCrewNewsStyleSelfHealV181() {
  const ss = assertTargetSpreadsheet_();
  const handlers = { refreshCrewNewsV180: true, refreshCrewNewsV181: true };
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers[trigger.getHandlerFunction()]) ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('refreshCrewNewsV181')
    .timeBased()
    .everyMinutes(CREW_AUTOMATION.TRIGGER_MINUTES)
    .create();

  PropertiesService.getDocumentProperties().setProperty(
    'CREW_AUTOMATION_SCRIPT_VERSION',
    CREW_STYLE_SELF_HEAL_V181.SCRIPT_VERSION
  );

  refreshCrewNewsV181();
}

function uninstallCrewNewsStyleSelfHealV181() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'refreshCrewNewsV181') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('refreshCrewNewsV180')
    .timeBased()
    .everyMinutes(CREW_AUTOMATION.TRIGGER_MINUTES)
    .create();
}

function refreshCrewNewsV181() {
  refreshCrewNewsV180();

  const ss = assertTargetSpreadsheet_();
  const main = ss.getSheetByName(CREW_AUTOMATION.MAIN_SHEET);
  const configSheet = ss.getSheetByName(CREW_AUTOMATION.CONFIG_SHEET);
  const statusSheet = ss.getSheetByName(CREW_AUTOMATION.STATUS_SHEET);
  if (!main || !configSheet || !statusSheet) {
    throw new Error('메인/설정/상태 시트를 확인해 주세요.');
  }

  const crews = readCrewConfig_(configSheet);
  let repairedCount = 0;
  crews.forEach(function(crew) {
    if (repairCrewNewsStyleV181_(main, crew)) repairedCount += 1;
  });

  writeStyleSelfHealStatusV181_(statusSheet, repairedCount);
}

function normalizeHexColorV181_(value) {
  const color = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return '#' + color.slice(1).split('').map(function(ch) { return ch + ch; }).join('');
  }
  return color;
}

function crewPrefixColorMatchesV181_(range, crewName, expectedColor) {
  try {
    const rich = range.getRichTextValue();
    if (!rich) return false;
    const text = String(rich.getText() || '');
    const prefix = String(crewName || '') + ' -';
    if (!crewName || text.indexOf(prefix) !== 0) return false;
    const style = rich.getTextStyle(0, Math.min(prefix.length, text.length));
    if (!style || typeof style.getForegroundColor !== 'function') return false;
    return normalizeHexColorV181_(style.getForegroundColor()) === normalizeHexColorV181_(expectedColor);
  } catch (e) {
    return false;
  }
}

function repairCrewNewsStyleV181_(mainSheet, crew) {
  if (!mainSheet || !crew || !crew.newsCell || !crew.crew) return false;
  const range = mainSheet.getRange(crew.newsCell);
  const text = String(range.getDisplayValue() || '').trim();
  if (!text || text.indexOf(crew.crew + ' -') !== 0) return false;

  const color = String(
    crew.color || (CREW_AUTOMATION.COLORS && CREW_AUTOMATION.COLORS[crew.crew]) || ''
  ).trim();
  if (!color || crewPrefixColorMatchesV181_(range, crew.crew, color)) return false;

  writeCrewNewsCell_(range, crew.crew, color, text, getCurrentPostUrl_(range) || '');
  return true;
}

function writeStyleSelfHealStatusV181_(statusSheet, repairedCount) {
  const values = statusSheet.getDataRange().getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() === 'ScriptVersion') {
      statusSheet.getRange(i + 1, 2).setValue(CREW_STYLE_SELF_HEAL_V181.SCRIPT_VERSION);
      break;
    }
  }
  PropertiesService.getDocumentProperties().setProperty(
    'CREW_STYLE_REPAIRED_LAST_RUN',
    String(Number(repairedCount || 0))
  );
}
