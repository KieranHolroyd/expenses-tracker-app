import {
	createClient,
	type Client,
	type InArgs,
	type InStatement,
	type Row,
	type Transaction
} from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initializeSchema } from './schema';

export type Expense = {
	id: number;
	profile_id: number;
	name: string;
	category: string;
	amount_pence: number;
	cadence: 'Monthly' | 'Yearly';
	next_due_date: string;
	active: number;
};

/**
 * Turso in every deployed environment; a local SQLite file only as a development
 * convenience. Production without a Turso URL would silently write to the
 * container filesystem and lose every write on restart, so it fails loudly instead.
 */
function resolveConfig() {
	const url = process.env.TURSO_DATABASE_URL?.trim();
	if (url) return { url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() };

	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'TURSO_DATABASE_URL is required in production. Set it (and TURSO_AUTH_TOKEN) to your Turso database credentials.'
		);
	}

	const dataDir = process.env.LEDGERLY_DATA_DIR ?? join(process.cwd(), 'data');
	mkdirSync(dataDir, { recursive: true });
	return { url: `file:${join(dataDir, 'expenses.db')}` };
}

let connection: { client: Client; url: string } | undefined;

/**
 * Connected on first query rather than on import. SvelteKit's build-time route
 * analysis imports this module with NODE_ENV=production, and that must not have
 * to satisfy — or connect with — real database credentials.
 */
function connect() {
	if (!connection) {
		const config = resolveConfig();
		connection = { client: createClient(config), url: config.url };
	}
	return connection;
}

export const getClient = () => connect().client;

/** Where the data actually lives — handy for start-up logging and scripts. */
export const databaseUrl = () => connect().url;

export function close() {
	connection?.client.close();
	connection = undefined;
}

let schema: Promise<void> | undefined;

/** Runs the migrations once per process, and lets a failed run be retried. */
function ready() {
	schema ??= initializeSchema(getClient()).catch((error: unknown) => {
		schema = undefined;
		throw error;
	});
	return schema;
}

const plain = <T>(rows: Row[]) => rows.map((row) => ({ ...row })) as T[];

export async function query<T>(sql: string, args: InArgs = []): Promise<T[]> {
	await ready();
	const { rows } = await getClient().execute({ sql, args });
	return plain<T>(rows);
}

export async function queryOne<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
	return (await query<T>(sql, args))[0];
}

/** First column of the first row, for `SELECT COUNT(*)`-style queries. */
export async function pluck<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
	await ready();
	const { rows } = await getClient().execute({ sql, args });
	return rows[0]?.[0] as T | undefined;
}

export async function execute(sql: string, args: InArgs = []) {
	await ready();
	return getClient().execute({ sql, args });
}

/** Statements committed together in a single round trip. */
export async function batch(statements: InStatement[]) {
	if (!statements.length) return [];
	await ready();
	return getClient().batch(statements, 'write');
}

/** For writes that need to read a result before deciding the next statement. */
export async function transaction<T>(run: (tx: Transaction) => Promise<T>): Promise<T> {
	await ready();
	const tx = await getClient().transaction('write');
	try {
		const result = await run(tx);
		await tx.commit();
		return result;
	} finally {
		tx.close();
	}
}
