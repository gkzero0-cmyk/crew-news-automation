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

function cropPlanForSheet(width, height) {
  const w=Number(width)||0;
  const h=Number(height)||0;
  if (w < 80 || h < 80) return {crop:false,width:w,height:h};
  const ratio=h/w;

  // Ordinary thumbnails and mildly portrait images stay lossless.
  if (ratio < 1.45) return {crop:false,width:w,height:h};

  // Long poster: keep the upper 4:5 area where event title/characters are
  // normally concentrated. This turns a very tall poster into a readable
  // sheet thumbnail without touching the original image URL.
  const targetHeight=Math.min(h,Math.max(1,Math.round(w*1.25)));
  if (targetHeight >= Math.round(h*0.94)) return {crop:false,width:w,height:h};
  return {crop:true,left:0,top:0,width:w,height:targetHeight};
}

async function fitImageForSheet(buffer, contentType) {
  let sharp;
  try { sharp=require('sharp'); }
  catch (_) { return {buffer,contentType,cropped:false}; }

  try {
    const probe=sharp(buffer,{failOn:'none',animated:false});
    const meta=await probe.metadata();
    const plan=cropPlanForSheet(meta.width,meta.height);
    if (!plan.crop || !['jpeg','png','webp'].includes(String(meta.format||'').toLowerCase())) {
      return {buffer,contentType,cropped:false};
    }

    let pipeline=sharp(buffer,{failOn:'none',animated:false}).extract({
      left:plan.left,top:plan.top,width:plan.width,height:plan.height
    });
    let outType=contentType;
    if(meta.format==='jpeg'){
      pipeline=pipeline.jpeg({quality:91,mozjpeg:true});
      outType='image/jpeg';
    }else if(meta.format==='png'){
      pipeline=pipeline.png({compressionLevel:8});
      outType='image/png';
    }else{
      pipeline=pipeline.webp({quality:91});
      outType='image/webp';
    }
    return {buffer:await pipeline.toBuffer(),contentType:outType,cropped:true};
  } catch (_) {
    return {buffer,contentType,cropped:false};
  }
}

module.exports = async function handler(req,res) {
  const requestUrl=new URL(req.url||'/','https://crew-news.local');
  const url=normalizeImageUrl(requestUrl.searchParams.get('url')||'');
  const fit=requestUrl.searchParams.get('fit')||'';
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

    const data=Buffer.from(await upstream.arrayBuffer());
    // Avoid expensive transforms for unexpectedly huge upstream responses.
    const fitted=(fit==='sheet' && data.length<=12*1024*1024)
      ? await fitImageForSheet(data,type)
      : {buffer:data,contentType:type,cropped:false};

    res.setHeader('Content-Type',fitted.contentType||type);
    res.setHeader('X-Crew-Image-Fit',fitted.cropped?'top-poster':'original');
    res.setHeader('Cache-Control','public, max-age=21600, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control','public, max-age=604800, stale-while-revalidate=604800');
    return res.status(200).send(fitted.buffer);
  } catch (_) {
    return res.status(502).send('image proxy unavailable');
  }
};

module.exports._internals={normalizeImageUrl,allowed,cropPlanForSheet,fitImageForSheet};
