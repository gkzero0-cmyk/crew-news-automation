'use strict';

// Compatibility fallback for the currently deployed Apps Script v1.7.0.
// Google Sheets can render a fully transparent IMAGE() as black, so return
// one opaque pixel matching the crew sheet background (#efefef) instead.
// Apps Script v1.7.1 treats this endpoint as a clear directive and removes
// the IMAGE formula entirely.
const SHEET_BACKGROUND_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4//49AAWeAs7uCxfEAAAAAElFTkSuQmCC',
  'base64'
);

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.statusCode = 200;
  res.end(SHEET_BACKGROUND_PNG);
};
