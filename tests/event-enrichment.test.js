'use strict';
const assert = require('assert');
const enrichment = require('../lib/event-enrichment.js');

assert.strictEqual(enrichment.isOfficialBoard('✨ 공 지 사 항 ✨'), true, 'spaced notice board must be normalized');

const gang = enrichment.synthesizeCrewEvent([
  {id:'208659971',station:'rkdakstlr911',authorId:'rkdakstlr911',title:'할말있어',publishedAt:'2026-10-02 05:34:12',boardName:'공지사항',contents:'오늘 낮 제갈금자 눙지 냉장고를 부탁해부터 그냥서버 +강씨세가 화양의 미스테리까지 봐주신 형님들 감사합니다',imageUrl:''},
  {id:'208596429',station:'mmange2',authorId:'mmange2',title:'1001',publishedAt:'2026-10-01 18:31:51',boardName:'공지 ❁ᴗ͈ ˬ ᴗ͈)⁾⁾⁾',contents:'9시에 강씨세가 미스테리 본다구 해서 8시에 올게여',imageUrl:''},
  {id:'208590271',station:'nangnan',authorId:'nangnan',title:'10.1 방송공지',publishedAt:'2026-10-01 17:17:09',boardName:'오방공',contents:'저녁에 강씨세가 화양 미스테리 잇다구 하더라구용??? 와서 얘기랑 카페 좀 보다가 강씨세가 모일 거 같슴니당',imageUrl:''},
  {id:'208597179',station:'hwayang3',authorId:'hwayang3',title:'오늘 강씨세가 미스테리 있습니다 (10.1)',publishedAt:'2026-10-01 18:41:35',boardName:'🕹️ㅣ방송 공지',contents:'방송은 7시 10분까지 키도록 하겠습니다 !',imageUrl:''}
], '강씨세가', 'rkdakstlr911');
assert.ok(gang, 'Gangssi event should be synthesized');
assert.strictEqual(gang.activityDate, '2026-10-01');
assert.strictEqual(gang.displaySummary, '강씨세가 미스테리 w. 화양');
assert.strictEqual(gang.id, '208597179', 'specific collaborator post should represent the event');

const unrelatedGangVod = enrichment.attachBestImage(gang, [], [
  {id:'x',station:'rkdakstlr911',title:'강만식 개인방송',publishedAt:'2026-10-01 20:00:00',imageUrl:'https://videoimg.sooplive.com/unrelated.jpg'}
], 'rkdakstlr911');
assert.strictEqual(unrelatedGangVod.imageUrl, '', 'same-day but unrelated leader VOD must not be used');

const jojuk = enrichment.synthesizeCrewEvent([
  {id:'208659119',station:'yjkim5500',authorId:'yjkim5500',title:'오늘 방송은요오',publishedAt:'2026-10-02 05:04:58',boardName:'⭐ 공지 사항',contents:'조적단 콘텐츠 진석이 첫 컨텐츠 조적단과 함께하는 놀라운 토요일',imageUrl:''},
  {id:'208675943',station:'thswlstjr666',authorId:'thswlstjr666',title:'오늘은 드디어 VRC 컨텐츠 놀숲합니다',publishedAt:'2026-10-02 14:07:45',boardName:'✨ 공 지 사 항 ✨',contents:'드디어 진행하는 놀숲입니다! 조적단 친구들 이랑 같이 진행합니다',imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/4/16029964/75051790917609278.png',sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url=x&fit=sheet'}
], '조적단', 'yjkim5500');
assert.ok(jojuk);
assert.strictEqual(jojuk.displaySummary, '조적단 VRC 놀숲');
assert.strictEqual(jojuk.id, '208675943');
assert.strictEqual(jojuk.imageSource, 'post_self');

const jara = enrichment.synthesizeCrewEvent([
  {id:'a',station:'dstv',authorId:'dstv',title:'자라섬 합방',publishedAt:'2026-10-02 17:00:00',boardName:'공지사항',contents:'오늘 자라섬 멤버들이랑 피파 CK 합방합니다',imageUrl:''},
  {id:'b',station:'member2',authorId:'member2',title:'오늘 자라섬 피파 CK',publishedAt:'2026-10-02 17:05:00',boardName:'공지사항',contents:'자라섬 피파 CK 합방 8시',imageUrl:'https://stimg.sooplive.com/NORMAL_BBS/jara.png',sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url=jara&fit=sheet'}
], '자라섬', 'dstv');
assert.ok(jara);
assert.strictEqual(jara.displaySummary, '자라섬 피파 CK 합방');
assert.strictEqual(jara.id, 'b');

const jail = enrichment.synthesizeCrewEvent([
  {id:'208308549',station:'amanemay',authorId:'amanemay',title:'26-09-28 오뱅꽁 오후 1시 장지수용소 점호',publishedAt:'2026-09-28 12:41:35',boardName:'🔔| 방송 ON',contents:'장지수용소 점호 오늘은 점호가 있는 날 수용소 친구들이랑 만나는 날',imageUrl:''}
], '장지수용소', 'iamquaddurup');
assert.ok(jail);
assert.strictEqual(enrichment.verifiedVodIdFor('장지수용소',jail),'208336221');
const unverifiedJailVod = enrichment.attachBestImage(jail, [], [
  {id:'208336221',station:'iamquaddurup',title:'장지수 [무수]',publishedAt:'2026-09-28 20:04:59',imageUrl:'https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=x'}
], 'iamquaddurup');
assert.strictEqual(unverifiedJailVod.imageUrl, '', 'generic VOD title must require explicit event verification');
const jailWithImage = enrichment.attachBestImage(jail, [], [
  {id:'208336221',station:'iamquaddurup',title:'장지수 [무수]',publishedAt:'2026-09-28 20:04:59',imageUrl:'https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=x',sheetImageUrl:'https://crew-news-automation.vercel.app/api/image?url=vod&fit=sheet',verifiedEventMedia:true}
], 'iamquaddurup');
assert.strictEqual(jailWithImage.imageSource, 'leader_vod_same_day');
assert.strictEqual(jailWithImage.fallbackVodUrl, 'https://vod.sooplive.com/player/208336221');

console.log('event-enrichment tests passed');
