'use strict';

// Cache only public SOOP board-menu metadata; fresh posts are always rechecked.
const crewNews=require('../internal/crew-news.js');
const {POLICY_VERSION}=require('../lib/version.js');

module.exports=async function handler(req,res) {
  res.setHeader('X-Crew-News-Policy',POLICY_VERSION);
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const url=new URL(req.url||'/', 'https://crew-news.local');
  const station=crewNews._internals.safeStation(url.searchParams.get('station')||'');
  if(!station)return res.status(400).json({ok:false,error:'invalid_station'});
  const metrics=crewNews._internals.createSoopRequestMetrics();
  const data=await crewNews._internals.fetchMenu(station,{
    Referer:'https://www.sooplive.com/station/'+station+'/post',
    Origin:'https://www.sooplive.com'
  },metrics,{direct:true});
  if(data.error||!data.source){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vercel-CDN-Cache-Control','no-store');
    return res.status(502).json({ok:false,error:'soop_menu_unavailable',station});
  }
  res.setHeader('Cache-Control','public, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=3600');
  return res.status(200).json({
    ok:true,station,board:data.rows,source:data.source,
    upstreamRequestCount:metrics.menuRequests
  });
};
