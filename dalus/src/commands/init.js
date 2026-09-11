'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE = `{
  // dalus config — see https://github.com/ (your Cobinar docs link here)
  // for the full field reference. Paths below are relative to this file.

  // Optional — if omitted, dalus uses whatever worker URL you logged in
  // with ("dalus login"). Set this when a project should always deploy
  // to a specific worker regardless of who's running "dalus forge".
  // "apiBase": "https://worker.lobby.cobinar.com",

  "workers": [
    // { "name": "my-api", "main": "./worker.js",
    //   "bindings": [
    //     { "name": "MY_BUCKET", "type": "storage", "resource": "my-bucket" }
    //   ],
    //   "secrets": ["SOME_API_KEY"] }
  ],
  "pages": [
    // { "name": "my-site", "dir": "./public" }
  ],
  "storage": [
    // { "name": "my-bucket", "dir": "./assets", "public": true }
  ],
  "database": [
    // { "name": "my_collection", "seed": "./seed.json" }
  ],
  "vault": [
    // { "name": "my-vault", "rules": "./rules.txt" }
  ]

  // Named environments (optional) — "dalus forge --env staging" uses
  // these instead of the top-level lists above, per resource kind:
  // "env": {
  //   "staging": { "workers": [ { "name": "my-api-staging", "main": "./worker.js" } ] }
  // }
}
`;

function initCommand(args) {
  const target = path.join(process.cwd(), 'dalus.jsonc');
  if (fs.existsSync(target) && !args.includes('--force')) {
    console.error(`${target} already exists — pass --force to overwrite.`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(target, TEMPLATE);
  console.log(`Created ${target}. Fill in the resources you want, then run "dalus forge".`);
}

module.exports = { initCommand };
