from pathlib import Path

path = Path('apps-script/Code.gs')
text = path.read_text()


def one(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


one("SCRIPT_VERSION: 'crew-apps-script-v1.7.5'", "SCRIPT_VERSION: 'crew-apps-script-v1.7.6'", 'version')

one(
    "    const crews = readCrewConfig_(configSheet);\n\n    const runResults = [];",
    "    const crews = readCrewConfig_(configSheet);\n    const validation = validateCrewConfigAndMain_(main, crews);\n\n    const runResults = [];",
    'validation call')

one(
    "    setAutomationState_('ACTIVE', new Date(), diagnostics);",
    "    setAutomationState_('ACTIVE', new Date(), diagnostics);\n    writeOperatorSummary_(statusSheet, crews, runResults, validation, diagnostics);",
    'operator summary call')

marker = "function readStatusCutoffs_(sheet) {"
helpers = r'''function validateCrewConfigAndMain_(mainSheet, crews) {
  const configIssues = [];
  const memberIssues = [];
  const stationOwners = {};
  const declaredCounts = {};
  let totalMembers = 0;

  (crews || []).forEach(function(crew) {
    totalMembers += Array.isArray(crew.members) ? crew.members.length : 0;
  });

  // 실제 Google Sheet에는 getLastRow가 항상 있지만, 최소 기능 테스트/비표준 호스트에서는
  // 검증 단계가 본 갱신을 막지 않도록 안전하게 건너뛴다.
  if (!mainSheet || typeof mainSheet.getLastRow !== 'function') {
    return {
      configOk: true,
      memberOk: true,
      configIssues: [],
      memberIssues: [],
      totalCrews: (crews || []).length,
      totalMembers: totalMembers
    };
  }

  const lastRow = Math.max(1, mainSheet.getLastRow());
  mainSheet.getRange(1, 1, lastRow, 1).getDisplayValues().forEach(function(row) {
    const match = String(row[0] || '').trim().match(/^(.+)\((\d+)\)$/);
    if (match) declaredCounts[match[1].trim()] = Number(match[2]);
  });

  (crews || []).forEach(function(crew) {
    const members = Array.isArray(crew.members) ? crew.members : [];

    if (!crew.newsCell || !crew.imageCell || !crew.imageRange) {
      configIssues.push(crew.crew + ': 필수 셀 설정 누락');
    }

    const leaders = members.filter(function(member) { return member.leader === true; });
    if (leaders.length !== 1) {
      configIssues.push(crew.crew + ': 크루장 ' + leaders.length + '명');
    }

    members.forEach(function(member) {
      const station = String(member.station || '').trim().toLowerCase();
      if (!station) {
        configIssues.push(crew.crew + '/' + member.name + ': 방송국 ID 누락');
        return;
      }
      if (stationOwners[station]) {
        configIssues.push('중복 방송국 ID ' + station + ': ' + stationOwners[station] + ', ' + crew.crew + '/' + member.name);
      } else {
        stationOwners[station] = crew.crew + '/' + member.name;
      }
    });

    if (!Object.prototype.hasOwnProperty.call(declaredCounts, crew.crew)) {
      memberIssues.push(crew.crew + ': 메인 인원수 표기 없음');
    } else if (declaredCounts[crew.crew] !== members.length) {
      memberIssues.push(crew.crew + ': 표기 ' + declaredCounts[crew.crew] + '명 / 설정 ' + members.length + '명');
    }

    if (crew.imageRange) {
      try {
        const block = mainSheet.getRange(crew.imageRange);
        const values = mainSheet.getRange(block.getRow(), 1, block.getNumRows(), 9).getDisplayValues();
        const present = {};
        values.forEach(function(row) {
          row.forEach(function(value) {
            const key = String(value || '').trim();
            if (key) present[key] = true;
          });
        });
        const missing = members.filter(function(member) { return !present[member.name]; }).map(function(member) { return member.name; });
        if (missing.length) memberIssues.push(crew.crew + ': 메인 명단 누락 ' + missing.join(', '));
      } catch (e) {
        memberIssues.push(crew.crew + ': 메인 명단 검사 실패');
      }
    }
  });

  return {
    configOk: configIssues.length === 0,
    memberOk: memberIssues.length === 0,
    configIssues: configIssues,
    memberIssues: memberIssues,
    totalCrews: (crews || []).length,
    totalMembers: totalMembers
  };
}

function writeOperatorSummary_(sheet, crews, runResults, validation, diagnostics) {
  try {
    const results = Array.isArray(runResults) ? runResults : [];
    const healthy = results.filter(function(row) {
      return row && !row.apiFailed && String(row.healthStatus || 'healthy').toLowerCase() !== 'unhealthy';
    }).length;
    const errors = results.filter(function(row) { return row && row.apiFailed; }).length;
    const validationWarnings = (validation.configIssues || []).length + (validation.memberIssues || []).length;
    const overall = errors > 0 ? 'ERROR' : (validationWarnings > 0 ? 'WARN' : 'OK');
    const soop = diagnostics && diagnostics.soopMetrics || emptySoopMetrics_();

    sheet.getRange('G11:H11').setValues([['운영요약', '값']]);
    sheet.getRange('G12:H20').setValues([
      ['OverallStatus', overall],
      ['HealthyCrews', healthy + '/' + (crews || []).length],
      ['ConfigCrews', Number(validation.totalCrews || 0)],
      ['ConfigMembers', Number(validation.totalMembers || 0)],
      ['ConfigValidation', validation.configOk ? 'OK' : validation.configIssues.join(' | ')],
      ['MemberCountValidation', validation.memberOk ? 'OK' : validation.memberIssues.join(' | ')],
      ['AutomationInterval', CREW_AUTOMATION.TRIGGER_MINUTES + '분'],
      ['SOOPTotalRequests', Number(soop.totalRequests || 0)],
      ['SummaryUpdatedAt', formatStatusDate_(new Date())]
    ]);
    sheet.getRange('G11:H11').setFontWeight('bold');
  } catch (e) {
    // 요약 기록 실패는 본 갱신을 막지 않는다.
  }
}

'''
if marker not in text:
    raise SystemExit('helper insertion marker missing')
text = text.replace(marker, helpers + marker, 1)

one(
    "  const localMatches = Boolean(samePost && sameText && imageMatches);",
    "  const fullLinkMatches = !selected.postUrl || hasFullCellLink_(newsRange, selected.postUrl);\n  const localMatches = Boolean(samePost && sameText && imageMatches && fullLinkMatches);",
    'full-link migration check')

one(
    "  if (pinIndex >= 0 && linkUrl) {\n\n    // 링크를 먼저 설정하고 마지막에 스타일을 덮어써야 Google 기본 파란색/밑줄이 남지 않는다.\n\n    builder = builder.setLinkUrl(pinIndex, pinIndex + 2, linkUrl);\n\n  }",
    "  if (linkUrl) {\n\n    // 전체 텍스트를 원문으로 연결하되, 마지막에 스타일을 덮어써 기본 파란색/밑줄을 제거한다.\n\n    builder = builder.setLinkUrl(0, text.length, linkUrl);\n\n  }",
    'full text source link')

marker2 = "function getCurrentPostUrl_(range) {"
helper2 = r'''function hasFullCellLink_(range, expectedUrl) {
  try {
    const rich = range.getRichTextValue();
    if (!rich) return false;
    return normalizeUrl_(rich.getLinkUrl()) === normalizeUrl_(expectedUrl);
  } catch (e) {
    return false;
  }
}

'''
if marker2 not in text:
    raise SystemExit('full-link helper marker missing')
text = text.replace(marker2, helper2 + marker2, 1)

path.write_text(text)

for test_path in Path('tests').glob('*.test.js'):
    t = test_path.read_text()
    t = t.replace('crew-apps-script-v1.7.5', 'crew-apps-script-v1.7.6')
    t = t.replace('v1\\.7\\.5', 'v1\\.7\\.6')
    test_path.write_text(t)
