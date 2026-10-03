'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');

function makeRange(initialFormula) {
  let formula = initialFormula || '';
  let cleared = 0;
  return {
    getDisplayValue: () => '강씨세가 - 강씨세가 미스테리 w. 화양 (10/1) 📌',
    getFormula: () => formula,
    getRichTextValue: () => ({
      getLinkUrl: () => 'https://www.sooplive.com/station/hwayang3/post/208597179',
      getRuns: () => []
    }),
    clearContent: () => { formula = ''; cleared += 1; },
    setFormula: value => { formula = value; },
    setRichTextValue: () => {},
    setHorizontalAlignment: () => ({ setVerticalAlignment: () => {} }),
    get cleared() { return cleared; },
    get formula() { return formula; }
  };
}

const newsRange = makeRange('');
const imageRange = makeRange('=IMAGE("https://crew-news-automation.vercel.app/api/blank-image",1)');
const mainSheet = {
  getRange: a1 => a1 === 'B4' ? newsRange : imageRange,
  getImages: () => []
};
const props = {};
const ctx = vm.createContext({
  console, Date, JSON, Object, String, Array,
  SpreadsheetApp: {
    newTextStyle: () => ({ setFontFamily(){return this;}, setFontSize(){return this;}, setBold(){return this;}, setForegroundColor(){return this;}, setUnderline(){return this;}, build(){return {};}}),
    newRichTextValue: () => ({ setText(){return this;}, setLinkUrl(){return this;}, setTextStyle(){return this;}, build(){return {};}})
  },
  PropertiesService: { getDocumentProperties: () => ({
    getProperty: k => props[k] || '',
    setProperty: (k,v) => { props[k] = v; },
    deleteProperty: k => { delete props[k]; }
  }) }
});
vm.runInContext(source, ctx);

const crew = {
  crew: '강씨세가', newsCell: 'B4', imageCell: 'C4', imageRange: 'C4', color: '#dab04d',
  members: [{station:'rkdakstlr911'}]
};
const payload = {
  ok: true,
  complete: true,
  preservePrevious: false,
  reliableEmpty: false,
  policyVersion: 'test-policy',
  healthStatus: 'healthy',
  selectedFingerprint: 'fp-new',
  shouldWrite: false,
  unchanged: true,
  updateAction: 'skip_unchanged',
  selected: {
    id: '208597179',
    station: 'hwayang3',
    postUrl: 'https://www.sooplive.com/station/hwayang3/post/208597179',
    displayText: '강씨세가 - 강씨세가 미스테리 w. 화양 (10/1) 📌',
    sourcePublishedAt: '2026-10-01 18:41:35',
    imageUrl: '',
    sheetImageUrl: 'https://crew-news-automation.vercel.app/api/blank-image',
    imageSource: 'none'
  },
  results: []
};

const result = ctx.refreshOneCrew_(mainSheet, crew, payload, {fallbackRequests:0});
assert.equal(imageRange.formula, '', 'blank-image clear directives must leave the image cell truly empty');
assert.ok(imageRange.cleared > 0, 'the existing IMAGE formula must be removed');
assert.match(result.imageState, /비움|삭제|이미지 없음/, 'status should describe an empty image cell rather than a retained placeholder');
console.log('Apps Script image clear regression: ok');
