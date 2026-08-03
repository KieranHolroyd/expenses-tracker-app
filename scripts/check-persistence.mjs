import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';

const config = JSON.parse(
	execFileSync('docker', ['compose', 'config', '--format', 'json'], {
		env: { ...process.env, ORIGIN: 'http://localhost:3000' },
		encoding: 'utf8'
	})
);
const service = config.services?.ledgerly;

assert(service, 'Compose must define the ledgerly service');

const dataDirectory = service.environment?.LEDGERLY_DATA_DIR;
assert(dataDirectory, 'LEDGERLY_DATA_DIR must be set explicitly in Compose');
assert(
	service.volumes?.some(
		(volume) => volume.type === 'volume' && volume.target === dataDirectory && volume.source
	),
	`LEDGERLY_DATA_DIR (${dataDirectory}) must be backed by a named volume`
);

console.log(`Database persistence configured: ${dataDirectory} is backed by a named volume.`);
