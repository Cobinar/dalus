'use strict';
const fs = require('fs');

/** Deploys one Document DB collection: find-or-create by name, then
 * optionally seeds it from a local JSON file (a single object -> one
 * document, an array -> one document per entry). Seeding only ever
 * ADDS documents — it doesn't diff against or replace what's already in
 * the collection, so re-running against a collection that already has
 * the seed data creates duplicates. Fine for "seed a fresh collection
 * once"; a real sync mode (matching on some key field) would need this
 * project's documents to have a stable id convention to match against,
 * which isn't assumed here. */
async function forgeDatabase(api, log, entry) {
  log(`Document DB: ${entry.name}`);

  let collection = await api.findByName('/database/collections', entry.name);
  if (!collection) {
    log(`  creating collection...`);
    collection = await api.post('/database/collections', { name: entry.name });
  }

  if (entry.seed) {
    const raw = JSON.parse(fs.readFileSync(entry.seed, 'utf8'));
    const docs = Array.isArray(raw) ? raw : [raw];
    for (const doc of docs) {
      await api.post(`/database/collections/${collection.id}/documents`, doc);
    }
    log(`  seeded ${docs.length} document${docs.length === 1 ? '' : 's'} from ${entry.seed}`);
  }

  log(`  done`);
}

module.exports = { forgeDatabase };
