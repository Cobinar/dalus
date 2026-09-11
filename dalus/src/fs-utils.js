'use strict';
const fs = require('fs');
const path = require('path');

/** Recursively lists every file under `dir`, returning paths relative to
 * `dir` with forward slashes (matching how the dashboard itself stores
 * Pages/Storage keys) — regardless of the host OS's own separator. */
function walkFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue; // .git, .DS_Store, etc.
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
  walk(dir);
  return out;
}

const EXT_TO_CONTENT_TYPE = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'application/javascript',
  mjs: 'application/javascript', json: 'application/json', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain', md: 'text/markdown',
  xml: 'application/xml', pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2',
};

function guessContentType(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EXT_TO_CONTENT_TYPE[ext] || 'application/octet-stream';
}

module.exports = { walkFiles, guessContentType };
