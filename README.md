# Ledgerly

A SvelteKit expense tracker for recurring costs and four-week payment-cycle forecasting.

## Run locally

```bash
pnpm install
pnpm seed
pnpm dev
```

With no Turso credentials set, the app falls back to a local SQLite file at `data/expenses.db`, so
development needs no setup. The seed command is idempotent and restores the starter
recurring-expense rows without deleting user-added data.

## Database

Ledgerly stores its data in [Turso](https://turso.tech) over libSQL. Create a database and a token:

```bash
turso db create ledgerly
turso db show ledgerly --url
turso db tokens create ledgerly
```

Put the results in `.env` (see `.env.example`):

```bash
TURSO_DATABASE_URL=libsql://ledgerly-yourname.turso.io
TURSO_AUTH_TOKEN=...
```

Both variables are required in production. The app refuses to start without `TURSO_DATABASE_URL`
when `NODE_ENV=production`, rather than silently falling back to container-local storage that
disappears on the next restart. Schema migrations run automatically on first use.

To point any command at the remote database instead of the local file, export the same two
variables first — `pnpm seed` and `pnpm dev` both honour them.

### Moving existing data to Turso

`pnpm migrate:turso` copies `data/expenses.db` into the database named by `TURSO_DATABASE_URL`:

```bash
export TURSO_DATABASE_URL=$(turso db show ledgerly --url)
export TURSO_AUTH_TOKEN=$(turso db tokens create ledgerly)
pnpm migrate:turso
```

It creates the schema first, copies only the columns both databases share, and refuses to run if
the target already holds data unless you pass `--force`.

`turso dev --db-file local.db` runs a libSQL server locally if you want to exercise the remote
code path without a network round trip.

## Data import

Use **Import CSV** on the Expenses page. Ledgerly accepts the original recurring-expenses sheet export or a conventional CSV with `Description` and `Amount` columns. Optional columns include `Date`, `Category`, `Type`, `Recurring Period`, `Status`, and `Necessity` (`Required` or `Optional`, defaulting to optional). Exports carry the same columns, so a round trip preserves what you have marked.

## Required expenses

Any expense can be marked **required** — rent, insurance, the bill you cannot drop. Nothing is
required until you say so, so an untouched line-up reads as entirely discretionary. Marking one
keeps it out of the cut-list what-if on Insights and sets the floor your recurring spend cannot go
below, which the Insights page reports against take-home pay, per category, and month by month.

## Auto-categorise

Set `OPENROUTER_API_KEY` and an **Auto-categorise** button appears on the Expenses page. It runs in
two model calls via [OpenRouter](https://openrouter.ai):

1. The whole expense list is read once and a single category set is proposed for it. The ceiling
   scales with the list — roughly one category per four expenses, never more than eight — so the
   model has to merge near-duplicates like "AI Services" and "AI Tools" rather than keep both.
2. Every expense is then filed under one of those categories, in batches of 60.

Category names that differ only by a filler word ("Services", "Tools", "Apps") or by plurality are
folded together locally as well, both when the set is proposed and when a reply is matched back
against it, so a stray synonym lands in the right category instead of being dropped.

Only rows whose category actually changes are written, and any reply naming a category outside the
proposed set — or an expense that isn't in the list — is dropped rather than saved, so a bad reply
can leave categories unchanged but never scramble them.

`OPENROUTER_MODEL` picks the model; it defaults to `openai/gpt-5.6-terra`.

Note that running it sends expense names, amounts and cadences to OpenRouter. That includes
passcode-protected profiles: the rows are decrypted in the server process to build the prompt.

## Quality checks

```bash
pnpm check
pnpm lint
pnpm build
```

Use `pnpm format` to apply Prettier formatting.

## Docker

The container keeps no local state — all data lives in Turso, so `ORIGIN`,
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are all required:

```bash
ORIGIN=https://expenses.example.com \
TURSO_DATABASE_URL=libsql://ledgerly-yourname.turso.io \
TURSO_AUTH_TOKEN=... \
docker compose up -d
```

Compose reads these from a local `.env` file too, which is easier than exporting them on every
command. The service listens on `127.0.0.1:3000` by default, ready for a TLS-terminating reverse
proxy, and runs with a read-only root filesystem.

Updating is just a pull and recreate — there is no volume to preserve:

```bash
docker compose pull
docker compose up -d
```

Run `pnpm check:persistence` to verify Compose passes real Turso credentials rather than falling
back to storage that disappears with the container.

To publish the service directly on every network interface, override the bind address:

```bash
ORIGIN=https://expenses.example.com LEDGERLY_BIND_ADDRESS=0.0.0.0 docker compose up -d
```

`LEDGERLY_PORT` changes the host port. `LEDGERLY_IMAGE` can pin a release or digest instead of
using `latest`, which is recommended for repeatable deployments.

To use the published image directly:

```bash
docker run -d \
  --name ledgerly \
  --restart unless-stopped \
  -p 3000:3000 \
  -e ORIGIN=http://localhost:3000 \
  -e TURSO_DATABASE_URL=libsql://ledgerly-yourname.turso.io \
  -e TURSO_AUTH_TOKEN=... \
  ghcr.io/kieranholroyd/expenses-tracker-app:latest
```

## Container publishing

The `Docker image` GitHub Actions workflow validates image builds on pull requests. Pushes to
`main` publish `main`, `latest`, and commit-SHA tags to GitHub Container Registry. Tags such as
`v1.2.3` additionally publish `1.2.3` and `1.2` image tags. The repository's built-in
`GITHUB_TOKEN` is used, so no registry secret is required.
