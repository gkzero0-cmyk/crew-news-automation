'use strict';
const POLICY='crew-automation-v1.3-server';
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  return res.status(200).json({
    ok:true,
    service:'crew-news-automation',
    policyVersion:POLICY,
    isolatedFrom:'chunbong-fansite',
    reliability:{
      schemaValidation:true,
      publicPostVerification:true,
      vodDetailVerification:true,
      activityDateSource:true,
      staleSourceProtection:true
    },
    timestamp:new Date().toISOString()
  });
};
