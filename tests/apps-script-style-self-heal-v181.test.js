'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=path.join(__dirname,'..','apps-script','StyleSelfHealV181.gs');
assert.ok(fs.existsSync(file));
const code=fs.readFileSync(file,'utf8');
const writes=[];
const trueUrl='https://www.sooplive.com/station/243000/post/208887819';
const context={
  console,Date,Math,JSON,String,Number,Boolean,Object,Array,RegExp,
  CREW_AUTOMATION:{COLORS:{'천타버스':'#61ffec'},TRIGGER_MINUTES:30},
  getCurrentPostUrl_(range){return range.getRichTextValue().getLinkUrl()||'';},
  normalizeUrl_(url){return String(url||'').trim();},
  writeCrewNewsCell_(range,crewName,color,text,linkUrl){writes.push({range,crewName,color,text,linkUrl});}
};
vm.createContext(context);vm.runInContext(code,context);
const text='천타버스 - 뇌피셜 게임 (10/15) 📌';
function fakeRange(options={}){
  const o={color:'#61ffec',body:'#ffffff',pin:'#ffffff',underline:false,link:trueUrl,...options};
  return {
    getDisplayValue(){return text;},
    getRichTextValue(){return {
      getText(){return text;},
      getLinkUrl(){return o.link;},
      getTextStyle(start,end){
        const prefix='천타버스 -'.length;
        const expected=start===0&&end===prefix;
        const body=start===prefix&&end===prefix+1;
        const pin=start===text.lastIndexOf('📌')&&end===text.length;
        assert.ok(expected||body||pin,'unexpected rich text range');
        const color=expected?o.color:body?o.body:o.pin;
        return {getForegroundColor(){return color;},isUnderline(){return o.underline;}};
      }
    }};
  };
}
const crew={crew:'천타버스',newsCell:'I6',color:'#61ffec'};
assert.equal(context.crewPrefixColorMatchesV181_(fakeRange({color:'#ffffff'}),crew.crew,crew.color),false);
assert.equal(context.crewPrefixColorMatchesV181_(fakeRange({color:'#61FFEC'}),crew.crew,crew.color),true);
const good=fakeRange();
assert.equal(context.crewNewsRichStyleMatchesV181_(good,crew.crew,crew.color,trueUrl),true);
assert.equal(context.repairCrewNewsStyleV181_({getRange(){return good;}},crew,trueUrl),false,'no redundant writes');
for(const [bad,msg] of [
  [{color:'#ffffff'},'prefix color'],
  [{body:'#ff0000'},'body color'],
  [{pin:'#ff0000'},'pin color'],
  [{underline:true},'underline'],
  [{link:''},'lost full-cell source URL'],
  [{link:'https://www.sooplive.com/station/other/post/111111'},'outdated source URL']
]){
  writes.length=0;
  const cell=fakeRange(bad);
  assert.equal(context.repairCrewNewsStyleV181_({getRange(){return cell;}},crew,trueUrl),true,msg);
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0],{range:cell,crewName:crew.crew,color:crew.color,text,linkUrl:trueUrl},msg);
}
const status={
  getDataRange(){return {getValues(){return [
    ['크루','검수시각','','','','','링크'],
    ['천타버스','','','','','',trueUrl],
    ['조적단','','','','','','https://not-suitable.example/path'],
  ];}};}
};
assert.equal(context.crewPostUrlsFromStatusV181_(status)['천타버스'],trueUrl);
assert.equal(context.crewPostUrlsFromStatusV181_(status)['조적단'],undefined);
assert.ok(code.includes('refreshCrewNewsV180();'));
assert.ok(code.includes("newTrigger('refreshCrewNewsV181')"));
assert.ok(code.includes('crewPostUrlsFromStatusV181_(statusSheet)'));
console.log('Apps Script v1.8.1 rich-title/link self-heal regression: ok');
