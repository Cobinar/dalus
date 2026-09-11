'use strict';
const fs = require('fs');
const path = require('path');
const { walkFiles, guessContentType } = require('../fs-utils');

/** Deploys one Static Hosting project: find-or-create by name, then PUT
 * every file under `dir`. Uploads are NOT diffed against what's already
 * there — every file in `dir` is re-uploaded every run, matching how
 * `wrangler pages deploy` treats a deploy as a fresh snapshot rather
 * than an incremental sync. Stale files left over from a previous
 * deploy (renamed/removed locally) are not currently cleaned up — worth
 * a `--clean` flag later if that turns out to matter in practice. */
async function forgePages(api, log, entry) {
  log(`Static Hosting: ${entry.name}`);
  const files = walkFiles(entry.dir);
  if (files.length === 0) throw new Error(`No files found in ${entry.dir}`);

  let project = await api.findByName('/pages/projects', entry.name);
  if (!project) {
    log(`  creating project...`);
    project = await api.post('/pages/projects', { name: entry.name });
  }

  for (const relPath of files) {
    const fullPath = path.join(entry.dir, relPath);
    const contentType = guessContentType(relPath);
    const body = fs.readFileSync(fullPath);
    await api.putRaw(`/pages/projects/${project.id}/files/${relPath}`, body, contentType);
    log(`  uploaded ${relPath} (${contentType})`);
  }

  log(`  done -> ${project.liveUrl || project.fallbackUrl || '(live link not returned by the API)'}`);
}

module.exports = { forgePages };
