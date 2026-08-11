import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';

const config = JSON.parse(
	execFileSync('docker', ['compose', 'config', '--format', 'json'], {
		env: {
			...process.env,
			ORIGIN: 'http://localhost:3000',
			TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ?? 'libsql://example.turso.io',
			TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ?? 'example-token'
		},
		encoding: 'utf8'
	})
);
const service = config.services?.ledgerly;

assert(service, 'Compose must define the ledgerly service');

const databaseUrl = service.environment?.TURSO_DATABASE_URL;
assert(databaseUrl, 'TURSO_DATABASE_URL must be passed to the container');
assert(service.environment?.TURSO_AUTH_TOKEN, 'TURSO_AUTH_TOKEN must be passed to the container');

// A file: URL inside a container with no volume is exactly the data-loss case
// this check exists to catch: every write would vanish on the next restart.
assert(
	/^(libsql|https|wss):\/\//.test(databaseUrl),
	`TURSO_DATABASE_URL must point at a remote Turso database, got "${databaseUrl}"`
);

// The app no longer reads LEDGERLY_DATA_DIR in production, so a lingering data
// volume would be a misleading no-op rather than a safety net.
assert(
	!service.environment?.LEDGERLY_DATA_DIR,
	'LEDGERLY_DATA_DIR is ignored now that the app is backed by Turso; remove it from Compose'
);
assert(
	!service.volumes?.length,
	'The app keeps no local state; remove the data volume from Compose'
);

console.log(`Database persistence configured: durable storage is Turso at ${databaseUrl}.`);
