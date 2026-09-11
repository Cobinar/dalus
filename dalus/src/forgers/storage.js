'use strict';
const fs = require('fs');
const path = require('path');
const { walkFiles, guessContentType } = require('../fs-utils');

/** Deploys one Object Storage bucket: find-or-create by name, flips
 * public access if configured, then PUTs every file under `dir` as an
 * object keyed by its relative path — same "re-upload everything every
 * run" behavior as the Pages forger, for the same reason (matching a
 * deploy tool's usual "this directory IS the desired state" model). */
async function forgeStorage(api, log, entry) {
  log(`Object Storage: ${entry.name}`);

  let bucket = await api.findByName('/storage/buckets', entry.name);
  if (!bucket) {
    log(`  creating bucket...`);
    bucket = await api.post('/storage/buckets', { name: entry.name });
  }

  if (typeof entry.public === 'boolean' && entry.public !== bucket.publicEnabled) {
    bucket = await api.patch(`/storage/buckets/${bucket.id}/public`, { enabled: entry.public });
    log(`  public access -> ${entry.public}`);
  }

  if (entry.dir) {
    const files = walkFiles(entry.dir);
    for (const relPath of files) {
      const fullPath = path.join(entry.dir, relPath);
      const contentType = guessContentType(relPath);
      const body = fs.readFileSync(fullPath);
      const result = await api.putRaw(`/storage/buckets/${bucket.id}/objects/${relPath}`, body, contentType);
      log(`  uploaded ${relPath}${result && result.url ? ` -> ${result.url}` : ''}`);
    }
  }

  log(`  done`);
}

module.exports = { forgeStorage };
