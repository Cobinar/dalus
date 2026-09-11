'use strict';
const { loadConfig, resolveEnv, loadCredentials } = require('../config');
const { ApiClient } = require('../api-client');
const { forgeWorker } = require('../forgers/workers');
const { forgePages } = require('../forgers/pages');
const { forgeStorage } = require('../forgers/storage');
const { forgeDatabase } = require('../forgers/database');
const { forgeVault } = require('../forgers/vault');

const KIND_FLAGS = {
  workers: '--workers',
  pages: '--pages',
  storage: '--storage',
  database: '--database',
  vault: '--vault',
};
const FORGERS = {
  workers: (api, log, entry, opts) => forgeWorker(api, log, entry, opts),
  pages: (api, log, entry) => forgePages(api, log, entry),
  storage: (api, log, entry) => forgeStorage(api, log, entry),
  database: (api, log, entry) => forgeDatabase(api, log, entry),
  vault: (api, log, entry) => forgeVault(api, log, entry),
};
// Bare `dalus forge` (no kind flags) deploys every kind — in THIS order,
// not object-key order: storage/database/vault/pages have no
// dependencies on anything else in this list, while a worker's bindings
// reference a storage bucket or Document DB collection by name and fail
// with a clear "doesn't exist yet" error if that resource isn't already
// forged. Deploying workers last means a bare `dalus forge` on a brand
// new project just works, instead of depending on running it twice.
const DEFAULT_KIND_ORDER = ['storage', 'database', 'vault', 'pages', 'workers'];

function parseForgeArgs(args) {
  const opts = { kinds: [], env: null, yes: args.includes('--yes'), only: null };
  for (const [kind, flag] of Object.entries(KIND_FLAGS)) {
    if (args.includes(flag)) opts.kinds.push(kind);
  }
  const envIdx = args.indexOf('--env');
  if (envIdx !== -1) opts.env = args[envIdx + 1];
  const onlyIdx = args.indexOf('--name');
  if (onlyIdx !== -1) opts.only = args[onlyIdx + 1]; // deploy just the one resource with this name, across whichever kind(s) it's found under
  return opts;
}

// `dalus forge` with no --pages/--workers/etc. deploys every resource
// kind present in the config — bare `dalus forge` is meant to mean "ship
// this whole project," matching the exact example in the original ask.
// Naming one or more kind flags narrows it to just those.
async function forgeCommand(args) {
  const opts = parseForgeArgs(args);
  const creds = loadCredentials();
  if (!creds) {
    console.error('Not logged in. Run "dalus login" first.');
    process.exitCode = 1;
    return;
  }

  let config;
  try {
    config = loadConfig();
    if (opts.env) config = resolveEnv(config, opts.env);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const api = new ApiClient({ apiBase: config.apiBase || creds.apiBase, token: creds.token });
  const kindsToRun = opts.kinds.length > 0 ? opts.kinds : DEFAULT_KIND_ORDER;

  const results = [];
  for (const kind of kindsToRun) {
    const entries = (config[kind] || []).filter((e) => !opts.only || e.name === opts.only);
    for (const entry of entries) {
      try {
        await FORGERS[kind](api, (line) => console.log(line), entry, opts);
        results.push({ kind, name: entry.name, ok: true });
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        results.push({ kind, name: entry.name, ok: false, error: err.message });
      }
      console.log('');
    }
  }

  if (results.length === 0) {
    console.log(
      opts.kinds.length > 0
        ? `No ${opts.kinds.join('/')} entries found in ${config.__configPath}.`
        : `Nothing to deploy — ${config.__configPath} has no workers/pages/storage/database/vault entries.`,
    );
    return;
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} deployed successfully.`);
  if (failed.length > 0) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.kind} ${f.name}: ${f.error}`);
    process.exitCode = 1;
  }
}

module.exports = { forgeCommand };
