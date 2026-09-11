'use strict';
// Config discovery and credential storage for dalus.
//
// Project config: dalus.jsonc, dalus.toml, or dalus.json, checked in the
// current directory in that order (first one found wins — this is the
// exact order named in the original ask: "look for file named
// dalus.jsonc, dalus.toml, or dalus."). Login credentials are kept
// entirely separate, in ~/.dalus/credentials.json, same reasoning
// Wrangler keeps its own auth out of the project directory: a project
// config is something you'd commit; a bearer token is not.

const fs = require('fs');
const path = require('path');
const os = require('os');
const toml = require('smol-toml');
const jsonc = require('jsonc-parser');

const CONFIG_FILENAMES = ['dalus.jsonc', 'dalus.toml', 'dalus.json'];
const CREDENTIALS_DIR = path.join(os.homedir(), '.dalus');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials.json');

class DalusConfigError extends Error {}

/** Searches the given directory (default: cwd) for a dalus config file,
 * in the fixed priority order above. Returns { path, format } or null if
 * none exist — forge.js decides what "none found" means for the command
 * being run, this module just reports the fact. */
function findConfigFile(dir = process.cwd()) {
  for (const name of CONFIG_FILENAMES) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      return { path: p, format: path.extname(name).slice(1) };
    }
  }
  return null;
}

/** Loads and parses whichever config file is found, resolving `dir`/
 * `main`/`rules`/`seed` fields in every resource entry to absolute paths
 * relative to the config file's own directory — so a project's resource
 * definitions keep working regardless of what directory `dalus forge`
 * happens to be invoked from. */
function loadConfig(dir = process.cwd()) {
  const found = findConfigFile(dir);
  if (!found) {
    throw new DalusConfigError(
      `No dalus.jsonc, dalus.toml, or dalus.json found in ${dir}.\nRun "dalus init" to create one, or pass --pages/--workers/etc. with the other required flags directly.`,
    );
  }
  const raw = fs.readFileSync(found.path, 'utf8');
  let parsed;
  try {
    if (found.format === 'toml') {
      parsed = toml.parse(raw);
    } else {
      const errors = [];
      parsed = jsonc.parse(raw, errors, { allowTrailingComma: true });
      if (errors.length > 0) {
        throw new DalusConfigError(`Could not parse ${found.path}: ${jsonc.printParseErrorCode(errors[0].error)} near offset ${errors[0].offset}`);
      }
    }
  } catch (err) {
    if (err instanceof DalusConfigError) throw err;
    throw new DalusConfigError(`Could not parse ${found.path}: ${err.message}`);
  }

  const baseDir = path.dirname(found.path);
  const resolvePathFields = (entry, fields) => {
    const out = { ...entry };
    for (const f of fields) {
      if (typeof out[f] === 'string') out[f] = path.resolve(baseDir, out[f]);
    }
    return out;
  };

  const resourceKinds = {
    workers: ['main'],
    pages: ['dir'],
    storage: ['dir'],
    database: ['seed'],
    vault: ['rules'],
  };
  const normalized = { apiBase: parsed.apiBase, env: {} };
  for (const kind of Object.keys(resourceKinds)) {
    normalized[kind] = (parsed[kind] || []).map((e) => resolvePathFields(e, resourceKinds[kind]));
  }
  if (parsed.env && typeof parsed.env === 'object') {
    for (const envName of Object.keys(parsed.env)) {
      const envBlock = parsed.env[envName] || {};
      normalized.env[envName] = {};
      for (const kind of Object.keys(resourceKinds)) {
        normalized.env[envName][kind] = (envBlock[kind] || []).map((e) => resolvePathFields(e, resourceKinds[kind]));
      }
    }
  }
  normalized.__configPath = found.path;
  return normalized;
}

/** Applies `--env NAME`, if given: for each resource kind, an env block
 * that defines that kind REPLACES the top-level list for it; a resource
 * kind the env block doesn't mention falls back to the top-level list.
 * This is a deliberately simpler model than Wrangler's deep-merge — easy
 * to explain, easy to predict what a given --env will actually deploy. */
function resolveEnv(config, envName) {
  if (!envName) return config;
  const envBlock = config.env && config.env[envName];
  if (!envBlock) {
    throw new DalusConfigError(`No [env.${envName}] block in ${config.__configPath}.`);
  }
  const merged = { ...config };
  for (const kind of ['workers', 'pages', 'storage', 'database', 'vault']) {
    if (envBlock[kind] && envBlock[kind].length > 0) merged[kind] = envBlock[kind];
  }
  return merged;
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveCredentials(creds) {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  // Same-user-only permissions — this file holds a real bearer token.
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function clearCredentials() {
  if (fs.existsSync(CREDENTIALS_PATH)) fs.unlinkSync(CREDENTIALS_PATH);
}

module.exports = {
  DalusConfigError,
  CONFIG_FILENAMES,
  CREDENTIALS_PATH,
  findConfigFile,
  loadConfig,
  resolveEnv,
  loadCredentials,
  saveCredentials,
  clearCredentials,
};
