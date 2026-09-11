'use strict';
const fs = require('fs');

/** Deploys one Vault: find-or-create by name, then uploads its rules
 * text if configured. Rules are validated server-side (a real parse —
 * see lib/rules.ts in the worker project) before being saved, so a
 * syntax error in the local rules file surfaces here as a clear error,
 * not a silent deploy of broken rules. */
async function forgeVault(api, log, entry) {
  log(`Vault: ${entry.name}`);

  let vault = await api.findByName('/vaults', entry.name);
  if (!vault) {
    log(`  creating vault...`);
    vault = await api.post('/vaults', { name: entry.name });
  }

  if (entry.rules) {
    const rules = fs.readFileSync(entry.rules, 'utf8');
    await api.put(`/vaults/${vault.id}/rules`, { rules });
    log(`  rules uploaded from ${entry.rules}`);
  }

  log(`  done -> data endpoint at ${vault.dataUrl || `${api.apiBase}/vault/${entry.name}`}`);
}

module.exports = { forgeVault };
