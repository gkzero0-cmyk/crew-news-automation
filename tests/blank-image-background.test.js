'use strict';
const assert = require('node:assert/strict');
const sharp = require('sharp');
const handler = require('../api/blank-image.js');

(async () => {
  const state = {headers:{}, body:null, statusCode:200};
  const res = {
    setHeader(name, value) { state.headers[String(name).toLowerCase()] = String(value); },
    set statusCode(value) { state.statusCode = Number(value); },
    get statusCode() { return state.statusCode; },
    end(body) { state.body = Buffer.from(body); }
  };
  handler({}, res);
  assert.equal(state.statusCode, 200);
  assert.equal(state.headers['content-type'], 'image/png');
  const {data, info} = await sharp(state.body).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels, 3, 'fallback image must be opaque RGB so Sheets cannot render transparency as black');
  assert.deepEqual([...data.slice(0, 3)], [239,239,239], 'fallback pixel must match the sheet background #efefef');
  console.log('blank image fallback matches sheet background: ok');
})().catch(err => { console.error(err); process.exit(1); });
