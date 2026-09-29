'use strict';

const SOOP_IMAGE_HOSTS = new Set([
  'stimg.sooplive.com','stimg.sooplive.co.kr',
  'res.sooplive.com','res.sooplive.co.kr',
  'vodimg.sooplive.com','vodimg.sooplive.co.kr',
  'videoimg.sooplive.com','videoimg.sooplive.co.kr',
  'liveimg.sooplive.com','liveimg.sooplive.co.kr',
  'stimg.afreecatv.com','liveimg.afreecatv.com'
]);

function normalizeImageUrl(url='') {
  const value=String(url||'').trim();
  return value.startsWith('//') ? 'https:'+value : value;
}
function allowed(url) {
  try {
    const parsed=new URL(normalizeImageUrl(url));
    return parsed.protocol==='https:' && SOOP_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch (_) { return false; }
}
module.exports = async function handler(req,res) {
  const requestUrl=new URL(req.url||'/','https://crew-news.local');
  const url=normalizeImageUrl(requestUrl.searchParams.get('url')||'');
  if(!url || !allowed(url)) return res.status(400).send('invalid image url');
  try {
    const upstream=await fetch(url,{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        'Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language':'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer':'https://www.sooplive.com/'
      },
      redirect:'follow'
    });
    if(!upstream.ok) return res.status(upstream.status).send('image upstream error');
    const type=upstream.headers.get('content-type')||'';
    if(!/^image\//i.test(type)) return res.status(415).send('upstream is not image');
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control','public, max-age=21600, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control','public, max-age=604800, stale-while-revalidate=604800');
    const data=Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(data);
  } catch (_) {
    return res.status(502).send('image proxy unavailable');
  }
};