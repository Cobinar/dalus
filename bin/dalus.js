#!/usr/bin/env node
'use strict';

const { loginCommand } = require('../src/commands/login');
const { forgeCommand } = require('../src/commands/forge');
const { initCommand } = require('../src/commands/init');

const HELP = `dalus — deploy Cobinar projects from the command line

Usage:
  dalus login [--api-base <url>] [--token <token>]
  dalus login --whoami
  dalus login --logout
  dalus init [--force]
  dalus forge [--pages] [--workers] [--storage] [--database] [--vault]
              [--env <name>] [--name <resourceName>] [--yes]

  Bare "dalus forge" deploys every resource in dalus.jsonc / dalus.toml /
  dalus.json found in the current directory. Passing one or more of
  --pages/--workers/--storage/--database/--vault narrows it to just
  those kinds. --env <name> deploys the [env.<name>] block instead of
  the top-level config. --name <resourceName> deploys just the one
  resource with that name. --yes skips interactive secret prompts
  (secrets with no matching environment variable are left unset).

Examples:
  dalus forge --pages
  dalus forge --workers --env staging
  dalus forge
`;

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'login':
      await loginCommand(args);
      break;
    case 'forge':
      await forgeCommand(args);
      break;
    case 'init':
      initCommand(args);
      break;
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
