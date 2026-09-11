'use strict';
const readline = require('readline');
const { saveCredentials, clearCredentials, loadCredentials, CREDENTIALS_PATH } = require('../config');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

// dalus does not implement Cobinar's own signup/login flow itself — that
// lives in cobinar-developers-worker (a separate system) and issues the
// bearer token the dashboard's browser session already uses. This
// command just stores a token you've already obtained (from that flow,
// wherever it prompts you for one) so dalus can send it on every
// request, the same way `gh auth login --with-token` accepts a token
// you got some other way rather than reimplementing GitHub's own login.
async function loginCommand(args) {
  if (args.includes('--logout')) {
    clearCredentials();
    console.log('Logged out.');
    return;
  }
  if (args.includes('--whoami')) {
    const creds = loadCredentials();
    if (!creds) { console.log('Not logged in.'); return; }
    console.log(`API base: ${creds.apiBase}`);
    console.log(`Token:    ${creds.token.slice(0, 8)}...${creds.token.slice(-4)} (stored in ${CREDENTIALS_PATH})`);
    return;
  }

  const apiBaseArgIdx = args.indexOf('--api-base');
  const tokenArgIdx = args.indexOf('--token');
  const apiBase = apiBaseArgIdx !== -1 ? args[apiBaseArgIdx + 1] : await ask('Cobinar dashboard-worker URL (e.g. https://worker.lobby.cobinar.com): ');
  // Visible input, deliberately — Node's readline has no built-in masked
  // prompt, and a hand-rolled no-echo hack is the kind of thing that's
  // easy to get subtly wrong (garbled input, doesn't work across
  // terminals) without a real TTY to test it against. --token on the
  // command line, or piping the value in, avoids the prompt entirely if
  // that matters more than a visible paste in a scrollback buffer.
  const token = tokenArgIdx !== -1 ? args[tokenArgIdx + 1] : await ask('Bearer token (visible as you type/paste — see the note in README.md): ');

  if (!apiBase || !token) {
    console.error('Both a worker URL and a token are required.');
    process.exitCode = 1;
    return;
  }

  saveCredentials({ apiBase: apiBase.replace(/\/$/, ''), token });
  console.log(`Saved to ${CREDENTIALS_PATH}. Run "dalus forge" from a project directory to deploy.`);
}

module.exports = { loginCommand };
