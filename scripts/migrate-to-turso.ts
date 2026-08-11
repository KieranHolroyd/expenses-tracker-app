/**
 * One-shot copy of the local SQLite database into Turso.
 *
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm migrate:turso
 *
 * Only columns present in both databases are copied, so this keeps working while
 * the schema is still gaining columns — anything the target has and the source
 * does not is left at its default.
 */
import process from 'node:process';
import { createClient, type InStatement } from '@libsql/client';
import { join } from 'node:path';
import { initializeSchema } from '../src/lib/server/schema';

const TABLES = ['profiles', 'expenses', 'app_settings'] as const;

const targetUrl = process.env.TURSO_DATABASE_URL?.trim();
const targetToken = process.env.TURSO_AUTH_TOKEN?.trim();
const sourcePath =
	process.env.LEDGERLY_SOURCE_DB ??
	join(process.env.LEDGERLY_DATA_DIR ?? join(process.cwd(), 'data'), 'expenses.db');

if (!targetUrl) {
	console.error('TURSO_DATABASE_URL is required. Create a database first:\n');
	console.error('  turso db create ledgerly');
	console.error('  export TURSO_DATABASE_URL=$(turso db show ledgerly --url)');
	console.error('  export TURSO_AUTH_TOKEN=$(turso db tokens create ledgerly)\n');
	process.exit(1);
}
if (targetUrl.startsWith('file:')) {
	console.error(`TURSO_DATABASE_URL must be a remote database, got "${targetUrl}".`);
	process.exit(1);
}

const source = createClient({ url: `file:${sourcePath}` });
const target = createClient({ url: targetUrl, authToken: targetToken });

const columnsOf = async (client: typeof source, table: string) => {
	const { rows } = await client.execute(`PRAGMA table_info(${table})`);
	return rows.map((row) => String(row.name));
};

async function migrate() {
	console.log(`Source: ${sourcePath}`);
	console.log(`Target: ${targetUrl}\n`);

	// The target may be brand new, so build the schema before copying into it.
	await initializeSchema(target);

	const force = process.argv.includes('--force');
	for (const table of TABLES) {
		const existing = Number(
			(await target.execute(`SELECT COUNT(*) FROM ${table}`)).rows[0][0] ?? 0
		);
		// initializeSchema seeds one profile and its settings, so those are not "existing data".
		const seeded = table === 'expenses' ? 0 : 1;
		if (existing > seeded && !force) {
			console.error(
				`Refusing to run: ${table} already holds ${existing} rows in the target database.`
			);
			console.error('Re-run with --force to overwrite matching rows by primary key.');
			process.exit(1);
		}
	}

	for (const table of TABLES) {
		const sourceColumns = await columnsOf(source, table);
		const targetColumns = new Set(await columnsOf(target, table));
		const shared = sourceColumns.filter((column) => targetColumns.has(column));
		const skipped = sourceColumns.filter((column) => !targetColumns.has(column));

		const { rows } = await source.execute(`SELECT ${shared.join(', ')} FROM ${table}`);
		const placeholders = shared.map(() => '?').join(', ');
		const statements: InStatement[] = rows.map((row) => ({
			sql: `INSERT OR REPLACE INTO ${table} (${shared.join(', ')}) VALUES (${placeholders})`,
			args: shared.map((column) => row[column])
		}));

		if (statements.length) await target.batch(statements, 'write');
		console.log(
			`${table}: copied ${statements.length} rows (${shared.length} columns` +
				`${skipped.length ? `, skipped ${skipped.join(', ')}` : ''})`
		);
	}

	console.log(
		'\nMigration complete. Verify with: turso db shell <name> "SELECT COUNT(*) FROM expenses"'
	);
	source.close();
	target.close();
}

migrate().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
