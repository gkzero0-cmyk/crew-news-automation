'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../apps-script/Code.gs'), 'utf8');

// Exercise real refresh, fetch, and status code against the external Apps Script services.
function runScenario(kind) {
  const cells = {}, calls = [], props = {};
  const config = [['crew','leader','member','url','news','image','range'],
    ['A', true, 'A', 'https://www.sooplive.com/station/aa', 'B4','C4','C4'],
    ['B', true, 'B', 'https://www.sooplive.com/station/bb', 'B5','C5','C5']];
  const payload = {ok:false, complete:false, preservePrevious:true, results:[], healthStatus:'degraded', policyVersion:'test-policy'};
  const sheet = {getDataRange:()=>({getValues:()=>config}), getRange:(a)=>({
    setValues:rows=>{rows.forEach(([k,v])=>{cells[k]=v;});},
    getDisplayValue:()=> 'existing news', getFormula:()=>'', getRichTextValue:()=>null
  })};
  let released = false;
  const ss = {getId:()=> '1-mACl-yykHphsqiSUNPkoC1GHydOYmWX-xHqdRz7DVM', getSheetByName:()=>sheet};
  const ctx = vm.createContext({console, Date, JSON, Object, String, Array,
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss},
    LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{released=true;}})},
    PropertiesService:{getDocumentProperties:()=>({getProperty:k=>props[k]||'',setProperty:(k,v)=>{props[k]=v;}})},
    Utilities:{formatDate:d=>d.toISOString()},
    UrlFetchApp:{fetch:(url, options)=>{
      calls.push(url);
      if(url.includes('/crew-news-all')) {
        assert.equal(options.method,'post');
        if(kind==='failure') throw new Error('network down');
        if(kind==='malformed') return {getResponseCode:()=>200,getContentText:()=>'<html>bad</html>'};
        const crews = kind==='partial'?['A']:['A','B'];
        return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({batches:crews.map(crew=>({crew,payload}))})};
      }
      return {getResponseCode:()=>503,getContentText:()=>JSON.stringify(payload)};
    }}
  });
  vm.runInContext(source, ctx);
  // News status formatting and header timestamp are separate existing behavior.
  vm.runInContext('writeStatus_ = function() {}; writeHeaderTimestamp_ = function() {};', ctx);
  ctx.refreshCrewNews();
  assert.ok(released);
  assert.equal(cells.ScriptVersion, 'crew-apps-script-v1.8.0');
  assert.equal(cells.APIBase, 'https://crew-news-automation.vercel.app');
  assert.equal(cells.FetchRequestCount, calls.length);
  assert.equal(cells.RunCompletedAt, cells.AppsScriptLastRun);
  assert.equal(cells.RunOutcome, 'completed_with_errors');
  assert.ok(calls.every(url=>url.startsWith('https://crew-news-automation.vercel.app/')));
  return {cells,calls};
}

let result = runScenario('success');
assert.equal(result.cells.FetchMode, 'single-batch-v1');
assert.equal(result.calls.length, 1);
assert.equal(result.cells.FallbackRequestCount, 0);
result = runScenario('partial');
assert.equal(result.cells.FetchMode, 'single-batch-v1+per-crew-fallback');
assert.equal(result.calls.length, 2);
assert.equal(result.cells.FallbackRequestCount, 1);
for (const kind of ['failure','malformed']) {
  result = runScenario(kind);
  assert.equal(result.cells.FetchMode, 'per-crew-fallback');
  assert.equal(result.calls.length, 3);
  assert.equal(result.cells.FallbackRequestCount, 2);
}
console.log('Apps Script diagnostics: 4 scenarios passed');
