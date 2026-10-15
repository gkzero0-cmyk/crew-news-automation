'use strict';
const assert=require('node:assert/strict');
const menu=require('../internal/crew-news.js')._internals;
const handler=require('../api/crew-menu.js');
const oldFetch=global.fetch;
const oldEnv=process.env.VERCEL_ENV;
const oldOverride=process.env.CREW_MENU_EDGE_CACHE;
const response=(body,cache='MISS')=>({
  ok:true,status:200,url:'https://crew-news-automation.vercel.app/api/crew-menu?station=test',
  headers:{get:key=>key==='x-vercel-cache'?cache:''},
  json:async()=>body,text:async()=>JSON.stringify(body)
});
const edge={ok:true,board:[{bbsNo:'1',name:'공지사항'}],source:'https://api-channel.sooplive.com/menu',upstreamRequestCount:1};
(async()=>{
  try {
    // Prove CDN activation does not depend on exposed Vercel system vars.
    delete process.env.VERCEL_ENV;
    process.env.CREW_MENU_EDGE_CACHE='on';
    menu.clearMenuCacheForTest();
    let urls=[];
    global.fetch=async url=>{urls.push(String(url));return response(edge,'HIT');};
    const hit=menu.createSoopRequestMetrics();
    const a=await menu.fetchMenu('testone',{},hit);
    assert.equal(a.byNo.get('1'),'공지사항');
    assert.equal(urls.length,1);
    assert.match(urls[0],/crew-news-automation\.vercel\.app\/api\/crew-menu/);
    assert.equal(hit.totalRequests,0,'CDN hit must not be counted as SOOP');
    assert.equal(hit.menuCacheHits,1);

    menu.clearMenuCacheForTest();
    urls=[];
    global.fetch=async url=>{urls.push(String(url));return response(edge,'MISS');};
    const miss=menu.createSoopRequestMetrics();
    await menu.fetchMenu('testtwo',{},miss);
    assert.equal(miss.menuRequests,1,'CDN miss counts as upstream SOOP');
    assert.equal(miss.totalRequests,1);

    menu.clearMenuCacheForTest();
    urls=[];
    global.fetch=async url=>{
      urls.push(String(url));
      if(String(url).includes('/api/crew-menu'))throw new Error('CDN unavailable');
      return response({board:[{bbsNo:'2',name:'정식 스케줄'}]});
    };
    const direct=await menu.fetchMenu('fallback',{},menu.createSoopRequestMetrics());
    assert.equal(direct.byNo.get('2'),'정식 스케줄','CDN failure must fall back');
    assert.equal(urls.length,2);

    menu.clearMenuCacheForTest();
    urls=[];
    global.fetch=async url=>{urls.push(String(url));return response({board:[{bbsNo:'3',name:'정식 공지'}]});};
    await menu.fetchMenu('authstation',{Cookie:'session=secret'},menu.createSoopRequestMetrics());
    assert.equal(urls.length,1);
    assert.match(urls[0],/api-channel\.sooplive\.com/,'auth must bypass shared CDN');

    // A local or staging run without the explicit feature flag stays direct.
    menu.clearMenuCacheForTest();
    delete process.env.CREW_MENU_EDGE_CACHE;
    urls=[];
    global.fetch=async url=>{urls.push(String(url));return response({board:[{bbsNo:'5',name:'공지'}]});};
    await menu.fetchMenu('flagoff',{},menu.createSoopRequestMetrics());
    assert.equal(urls.length,1);
    assert.match(urls[0],/api-channel\.sooplive\.com/,'absent flag must not call production CDN');
    process.env.CREW_MENU_EDGE_CACHE='on';

    menu.clearMenuCacheForTest();
    global.fetch=async()=>response({board:[{bbsNo:'11',name:'스케줄 게시판'}]});
    const res={headers:{},statusCode:200,
      setHeader(k,v){this.headers[k]=v;return this;},
      status(v){this.statusCode=v;return this;},
      json(v){this.body=v;return v;}};
    await handler({method:'GET',url:'/api/crew-menu?station=teststation'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.board[0].bbsNo,'11');
    assert.match(res.headers['Vercel-CDN-Cache-Control'],/s-maxage=21600/);
    assert.equal(res.body.upstreamRequestCount,1);

    const bad={setHeader(){},status(v){this.statusCode=v;return this;},json(v){this.body=v;return v;}};
    await handler({method:'GET',url:'/api/crew-menu?station=..'},bad);
    assert.equal(bad.statusCode,400);
    console.log('menu CDN caching regression: ok');
  } finally {
    global.fetch=oldFetch;
    menu.clearMenuCacheForTest();
    if(oldEnv===undefined)delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV=oldEnv;
    if(oldOverride===undefined)delete process.env.CREW_MENU_EDGE_CACHE;
    else process.env.CREW_MENU_EDGE_CACHE=oldOverride;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
