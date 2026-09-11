# dalus

A command-line deploy tool for Cobinar — the wrangler-equivalent for
Edge Compute, Static Hosting, Object Storage, Document DB, and Vault.
Doesn't talk to Cloudflare or implement any deploy mechanism of its own:
every command here is a thin, scriptable front door to
`cobinar-dashboard-worker`'s own REST API — the exact same endpoints the
web dashboard calls. See that project's README for the full endpoint
reference this is built on.

**Status**: v1. Real and working end-to-end against a mock of the real
API (27 passing scenarios — login, every resource kind, dependency
ordering, idempotent re-runs, named environments, both JSONC and TOML
config, and clean failure when not logged in) — not yet run against an
actual deployed `cobinar-dashboard-worker`, since this was built without
network access to one. The one thing worth a real smoke test before
relying on this day to day.

## Install

```
cd dalus
npm install
npm link   # makes the `dalus` command available globally
```

(Not published to npm — this is source you own and can change.)

## Log in

```
dalus login --api-base https://worker.lobby.cobinar.com --token <your bearer token>
```

dalus doesn't implement Cobinar's own signup/login flow — that lives in
`cobinar-developers-worker`, a separate system. This command stores a
token you've already obtained from wherever that flow gives you one, the
same way `gh auth login --with-token` accepts a token instead of
reimplementing GitHub's own login. Omit `--api-base`/`--token` to be
prompted instead. Credentials are stored in `~/.dalus/credentials.json`
(mode 0600), never inside a project directory.

`dalus login --whoami` shows what's currently stored (token
redacted). `dalus login --logout` clears it.

## Set up a project

```
dalus init
```

writes a starter `dalus.jsonc` with every resource kind commented out —
uncomment and fill in what your project actually needs. See
`dalus.jsonc`'s own comments for the full shape, or the example below.

## Deploy

```
dalus forge                 # deploys everything in the config
dalus forge --pages         # just the pages[] entries
dalus forge --workers       # just the workers[] entries
dalus forge --env staging   # deploys the [env.staging] block instead
dalus forge --name my-api   # just the one resource with this name
```

`dalus forge` looks for `dalus.jsonc`, `dalus.toml`, or `dalus.json` in
the current directory, in that order — first one found wins. A bare
`dalus forge` deploys `storage`, `database`, and `vault` first, then
`pages`, then `workers` last — not the order they're written in the
config — since a worker's bindings reference a bucket or collection by
name and need that resource to already exist. Passing specific
`--pages`/`--workers`/etc. flags deploys just those kinds, in the order
given; if you're deploying a worker with bindings in isolation (without
its target resources already forged), you'll get a clear error naming
exactly what's missing, not a confusing API failure.

Every resource is **find-or-create by name**: running `forge` again
against a project that's already deployed updates it in place rather
than creating a duplicate. Bindings and secrets sync the same way —
already-present bindings are left alone, secrets are always re-set
(harmless if the value hasn't changed).

### Example `dalus.jsonc`

```jsonc
{
  "workers": [
    { "name": "guestbook-api", "main": "./worker-service.js",
      "bindings": [
        { "name": "AVATARS", "type": "storage", "resource": "guestbook-avatars" },
        { "name": "CONFIG", "type": "database", "resource": "guestbook_config" }
      ],
      "secrets": ["GROQ_API_KEY"] }
  ],
  "pages": [
    { "name": "guestbook-site", "dir": "./pages" }
  ],
  "storage": [
    { "name": "guestbook-avatars", "dir": "./avatars", "public": true }
  ],
  "database": [
    { "name": "guestbook_config", "seed": "./config-seed.json" }
  ],
  "vault": [
    { "name": "guestbook-entries", "rules": "./vault-rules.txt" }
  ]
}
```

(This is, deliberately, the exact shape of the Cobinar Guestbook demo
from an earlier session — try pointing a `dalus.jsonc` at it.)

### Secrets

List secret **names** in config, never values — `dalus forge` resolves
each one from an environment variable of the same name
(`GROQ_API_KEY=sk-... dalus forge`), or prompts for it interactively if
the variable isn't set. `--yes` skips the prompt and leaves unset
secrets alone (for CI, where an interactive prompt would just hang).

### Named environments

```jsonc
{
  "workers": [ /* ... */ ],
  "env": {
    "staging": {
      "workers": [ { "name": "my-api-staging", "main": "./worker.js" } ]
    }
  }
}
```

`--env staging` uses `env.staging`'s lists **instead of** the top-level
ones, per resource kind — not a deep merge. A resource kind the env
block doesn't mention falls back to the top-level list for that kind
only. Simpler than Wrangler's own merge behavior, on purpose: easy to
predict exactly what a given `--env` run will touch just by reading that
one block.

## What's explicitly not here yet

- **The custom config-language idea** from the original ask (a language
  built specifically for this tool) — deferred by request; `dalus.jsonc`
  today is just JSONC, `dalus.toml` is just TOML.
- **SSL/TLS strictness flags** (`dalus --ssl/tls --1/2/3` or similar) —
  also explicitly deferred; nothing here touches TLS configuration.
- **Diffing/cleanup** — Pages and Storage uploads re-push every file in
  the configured directory every run; a file removed locally isn't
  removed remotely. Database seeding only ever adds documents (no
  matching-and-updating). A `--clean` or `--sync` mode that reconciles
  instead of just re-uploading would be the natural next step if that
  gap turns out to matter in practice.
- **`dalus forge --workers --env`** from the original examples — `--env`
  works as a flag needing a value (`--env staging`); if what was meant
  was `--env` as a bare toggle with different behavior, that's worth
  clarifying, since this implementation treats it the same way whether
  or not `--workers` is also passed.
