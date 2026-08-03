# Ledgerly

A SvelteKit expense tracker for recurring costs and four-week payment-cycle forecasting.

## Run locally

```bash
pnpm install
pnpm seed
pnpm dev
```

The SQLite database is created at `data/expenses.db`. The seed command is idempotent and restores the starter recurring-expense rows without deleting user-added data.

## Data import

Use **Import CSV** on the Expenses page. Ledgerly accepts the original recurring-expenses sheet export or a conventional CSV with `Description` and `Amount` columns. Optional columns include `Date`, `Category`, `Type`, and `Recurring Period`.

## Quality checks

```bash
pnpm check
pnpm lint
pnpm build
```

Use `pnpm format` to apply Prettier formatting.

## Docker

Start Ledgerly with a persistent SQLite volume:

```bash
docker compose up -d
```

The application is available at `http://localhost:3000`. SQLite data is stored in the
`ledgerly-data` volume and survives container replacement. Set `ORIGIN` to the public HTTPS URL
when running behind a domain:

```bash
ORIGIN=https://expenses.example.com docker compose up -d
```

To use the published image directly:

```bash
docker run -d \
  --name ledgerly \
  --restart unless-stopped \
  -p 3000:3000 \
  -e ORIGIN=http://localhost:3000 \
  -v ledgerly-data:/data \
  ghcr.io/kieranholroyd/expenses-tracker-app:latest
```

## Container publishing

The `Docker image` GitHub Actions workflow validates image builds on pull requests. Pushes to
`main` publish `main`, `latest`, and commit-SHA tags to GitHub Container Registry. Tags such as
`v1.2.3` additionally publish `1.2.3` and `1.2` image tags. The repository's built-in
`GITHUB_TOKEN` is used, so no registry secret is required.
