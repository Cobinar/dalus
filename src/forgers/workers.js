'use strict';
const fs = require('fs');
const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

/** Resolves { name, type: 'storage'|'database', resource } bindings from
 * config into the { resourceId } shape the API wants, by name-matching
 * against the owner's existing buckets/collections — bindings reference
 * resources by NAME in dalus config (portable across accounts/environments),
 * but the API itself keys them by id. */
async function resolveBindingResourceId(api, binding) {
  const listPath = binding.type === 'storage' ? '/storage/buckets' : '/database/collections';
  const kindLabel = binding.type === 'storage' ? 'storage bucket' : 'Document DB collection';
  const found = await api.findByName(listPath, binding.resource);
  if (!found) {
    throw new Error(`Binding "${binding.name}" references ${kindLabel} "${binding.resource}", which doesn't exist yet — forge that resource first (dalus forge --storage or --database).`);
  }
  return found.id;
}

async function syncBindings(api, log, serviceId, bindingsConfig) {
  if (!bindingsConfig || bindingsConfig.length === 0) return;
  const existing = await api.get(`/services/${serviceId}/bindings`);
  for (const binding of bindingsConfig) {
    if (existing.some((e) => e.bindingName === binding.name)) {
      log(`    binding ${binding.name} already exists, skipping`);
      continue;
    }
    const resourceId = await resolveBindingResourceId(api, binding);
    await api.post(`/services/${serviceId}/bindings`, {
      bindingName: binding.name,
      resourceType: binding.type,
      resourceId,
      canWrite: !!binding.canWrite,
    });
    log(`    bound env.${binding.name} -> ${binding.type}:${binding.resource}${binding.canWrite ? ' (read/write)' : ''}`);
  }
}

async function syncSecrets(api, log, serviceId, secretNames, { yes }) {
  if (!secretNames || secretNames.length === 0) return;
  for (const name of secretNames) {
    let value = process.env[name];
    if (!value) {
      if (yes) {
        log(`    skipping secret ${name} (no ${name} env var set, and --yes disables prompting)`);
        continue;
      }
      value = await prompt(`    Enter value for secret ${name} (or press Enter to skip): `);
      if (!value) { log(`    skipped ${name}`); continue; }
    }
    await api.post(`/services/${serviceId}/secrets`, { name, value });
    log(`    set secret env.${name}`);
  }
}

/** Deploys one Edge Compute service: find-or-create by name, upload its
 * code, then sync bindings and secrets. Bindings/secrets are synced
 * every run (idempotent — see syncBindings/syncSecrets above); the code
 * upload always overwrites, same as `wrangler deploy` always overwriting
 * a Worker's script. */
async function forgeWorker(api, log, entry, opts) {
  log(`Edge Compute: ${entry.name}`);
  if (!fs.existsSync(entry.main)) throw new Error(`main file not found: ${entry.main}`);
  const code = fs.readFileSync(entry.main, 'utf8');

  let svc = await api.findByName('/services', entry.name);
  if (!svc) {
    log(`  creating service...`);
    svc = await api.post('/services', { name: entry.name });
  }
  await api.put(`/services/${svc.id}/code`, { code });
  log(`  code uploaded (${code.length} bytes)`);

  await syncBindings(api, log, svc.id, entry.bindings);
  await syncSecrets(api, log, svc.id, entry.secrets, opts);

  log(`  done -> test at ${api.apiBase}/run/${entry.name}`);
}

module.exports = { forgeWorker };
