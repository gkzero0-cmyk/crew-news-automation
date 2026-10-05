'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '..', 'apps-script', 'StyleSelfHealV181.gs');
assert.ok(fs.existsSync(file), 'StyleSelfHealV181.gs must exist');
const code = fs.readFileSync(file, 'utf8');

const writes = [];
const context = {
  console, Date, Math, JSON, String, Number, Boolean, Object, Array, RegExp,
  CREW_AUTOMATION: { COLORS: { '천타버스': '#61ffec' }, TRIGGER_MINUTES: 30 },
  getCurrentPostUrl_() { return 'https://www.sooplive.com/station/243000/post/208887819'; },
  writeCrewNewsCell_(range, crewName, color, text, linkUrl) {
    writes.push({ range, crewName, color, text, linkUrl });
  }
};
vm.createContext(context);
vm.runInContext(code, context);

function fakeRange(prefixColor, text = '천타버스 - 뇌피셜 게임 (10/15) 📌') {
  return {
    getDisplayValue() { return text; },
    getRichTextValue() {
      return {
        getText() { return text; },
        getTextStyle(start, end) {
          assert.equal(start, 0);
          assert.equal(end, '천타버스 -'.length);
          return { getForegroundColor() { return prefixColor; } };
        }
      };
    }
  };
}

const crew = { crew: '천타버스', newsCell: 'I6', color: '#61ffec' };
assert.equal(context.crewPrefixColorMatchesV181_(fakeRange('#ffffff'), crew.crew, crew.color), false);
assert.equal(context.crewPrefixColorMatchesV181_(fakeRange('#61FFEC'), crew.crew, crew.color), true);

const broken = fakeRange('#ffffff');
const main = { getRange(cell) { assert.equal(cell, 'I6'); return broken; } };
assert.equal(context.repairCrewNewsStyleV181_(main, crew), true, 'broken prefix color must self-heal');
assert.equal(writes.length, 1);
assert.deepEqual(writes[0], {
  range: broken,
  crewName: '천타버스',
  color: '#61ffec',
  text: '천타버스 - 뇌피셜 게임 (10/15) 📌',
  linkUrl: 'https://www.sooplive.com/station/243000/post/208887819'
});

writes.length = 0;
const good = fakeRange('#61ffec');
assert.equal(context.repairCrewNewsStyleV181_({ getRange() { return good; } }, crew), false);
assert.equal(writes.length, 0, 'correct formatting must not cause a write');

assert.ok(code.includes('refreshCrewNewsV180();'), 'v1.8.1 wrapper must reuse the active v1.8 refresh');
assert.ok(code.includes('refreshCrewNewsV180: true'), 'installer must retire the old refresh trigger');
assert.ok(code.includes('refreshCrewNewsV181: true'), 'installer must remove duplicate v1.8.1 refresh triggers');
assert.ok(code.includes("newTrigger('refreshCrewNewsV181')"), 'installer must create one v1.8.1 refresh trigger');

console.log('Apps Script v1.8.1 style self-heal regression: ok');
