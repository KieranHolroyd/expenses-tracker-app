import type { Client } from '@libsql/client';

export const expenseSeed: Array<[string, string, number, 'Monthly' | 'Yearly', string]> = [
	['Claude Code', 'Software', 1800, 'Monthly', '2026-08-03'],
	['T3 Chat', 'Software', 729, 'Monthly', '2026-08-01'],
	['Turso', 'Infrastructure', 378, 'Monthly', '2026-08-01'],
	['Google Workspaces', 'Software', 1400, 'Monthly', '2026-08-01'],
	['Railway', 'Infrastructure', 1517, 'Monthly', '2026-07-30'],
	['Apple Developer License', 'Software', 7900, 'Yearly', '2027-07-30'],
	['YouTube Member', 'Entertainment', 598, 'Monthly', '2026-07-30'],
	['Amazon Prime', 'Lifestyle', 1198, 'Monthly', '2026-07-29'],
	['Picthing', 'Software', 472, 'Monthly', '2026-07-27'],
	['Hetzner', 'Infrastructure', 500, 'Monthly', '2026-07-25'],
	['Flux', 'Software', 1560, 'Monthly', '2026-07-25'],
	['YouTube Premium', 'Entertainment', 1999, 'Monthly', '2026-07-21'],
	['Cloudflare', 'Infrastructure', 1658, 'Monthly', '2026-07-17'],
	['Progressier', 'Software', 448, 'Monthly', '2026-07-17'],
	['ChatGPT', 'Software', 2000, 'Monthly', '2026-07-16'],
	['Twitch', 'Entertainment', 450, 'Monthly', '2026-08-06'],
	['Vercel', 'Infrastructure', 1801, 'Monthly', '2026-07-10'],
	['ElevenLabs', 'Entertainment', 450, 'Monthly', '2026-07-10'],
	['Nabu Casa', 'Home', 650, 'Monthly', '2026-07-04']
];

async function columnNames(client: Client, table: string) {
	const { rows } = await client.execute(`PRAGMA table_info(${table})`);
	return new Set(rows.map((row) => String(row.name)));
}

/**
 * `PRAGMA foreign_keys` is a connection-level setting that a remote Turso
 * database does not let us drive, so treat it as best-effort. It only matters
 * for the legacy migrations below, which never run against a database created
 * from the current schema.
 */
async function tryPragma(client: Client, pragma: string) {
	try {
		await client.execute(`PRAGMA ${pragma}`);
	} catch {
		// Not supported on this connection; the migrations below cope without it.
	}
}

/**
 * Rows belonging to a passcode-protected profile keep their sensitive values in
 * `secret` and leave the plaintext columns null, so both shapes live in one
 * table and only the encrypted columns had to be relaxed to nullable.
 */
const ENCRYPTED_ROW_CHECK = (columns: string[]) => `CHECK (
	(secret IS NULL AND ${columns.map((column) => `${column} IS NOT NULL`).join(' AND ')})
	OR (secret IS NOT NULL AND ${columns.map((column) => `${column} IS NULL`).join(' AND ')})
)`;

export async function initializeSchema(client: Client) {
	await tryPragma(client, 'journal_mode = WAL');
	await tryPragma(client, 'foreign_keys = OFF');
	await client.executeMultiple(`
		CREATE TABLE IF NOT EXISTS profiles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL COLLATE NOCASE UNIQUE,
			avatar_color TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		INSERT OR IGNORE INTO profiles (id, name, avatar_color) VALUES (1, 'Kieran', '#de735c');
		CREATE TABLE IF NOT EXISTS expenses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profiles(id) ON DELETE CASCADE,
			name TEXT,
			category TEXT,
			amount_pence INTEGER CHECK (amount_pence IS NULL OR amount_pence >= 0),
			cadence TEXT NOT NULL CHECK (cadence IN ('Monthly', 'Yearly')),
			next_due_date TEXT NOT NULL,
			active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
			secret TEXT,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			${ENCRYPTED_ROW_CHECK(['name', 'category', 'amount_pence'])}
		);
	`);

	const expenseColumns = await columnNames(client, 'expenses');
	if (!expenseColumns.has('profile_id')) {
		await client.execute(
			'ALTER TABLE expenses ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profiles(id) ON DELETE CASCADE'
		);
	}

	// Pre-passcode databases declared name/category/amount_pence NOT NULL, which
	// an encrypted row cannot satisfy, so the table is rebuilt rather than altered.
	if (!expenseColumns.has('secret')) {
		await client.batch(
			[
				`CREATE TABLE expenses_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profiles(id) ON DELETE CASCADE,
					name TEXT,
					category TEXT,
					amount_pence INTEGER CHECK (amount_pence IS NULL OR amount_pence >= 0),
					cadence TEXT NOT NULL CHECK (cadence IN ('Monthly', 'Yearly')),
					next_due_date TEXT NOT NULL,
					active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
					secret TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					${ENCRYPTED_ROW_CHECK(['name', 'category', 'amount_pence'])}
				)`,
				`INSERT INTO expenses_new (id, profile_id, name, category, amount_pence, cadence, next_due_date, active, created_at)
				SELECT id, profile_id, name, category, amount_pence, cadence, next_due_date, active, created_at FROM expenses`,
				'DROP TABLE expenses',
				'ALTER TABLE expenses_new RENAME TO expenses'
			],
			'write'
		);
	}

	const profileColumns = await columnNames(client, 'profiles');
	if (!profileColumns.has('passcode_salt')) {
		await client.execute('ALTER TABLE profiles ADD COLUMN passcode_salt TEXT');
	}
	if (!profileColumns.has('passcode_key')) {
		await client.execute('ALTER TABLE profiles ADD COLUMN passcode_key TEXT');
	}

	const settingsColumns = await columnNames(client, 'app_settings');
	if (settingsColumns.size && !settingsColumns.has('profile_id')) {
		await client.batch(
			[
				`CREATE TABLE app_settings_new (
					profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
					payment_amount_pence INTEGER NOT NULL CHECK (payment_amount_pence > 0),
					payday_anchor_date TEXT NOT NULL,
					cycle_days INTEGER NOT NULL DEFAULT 28 CHECK (cycle_days = 28),
					cycle_type TEXT NOT NULL DEFAULT 'four_week' CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday'))
				)`,
				`INSERT INTO app_settings_new (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type)
				SELECT 1, payment_amount_pence, payday_anchor_date, cycle_days, 'four_week' FROM app_settings WHERE id = 1`,
				'DROP TABLE app_settings',
				'ALTER TABLE app_settings_new RENAME TO app_settings'
			],
			'write'
		);
	}

	await client.executeMultiple(`
		CREATE TABLE IF NOT EXISTS app_settings (
			profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
			payment_amount_pence INTEGER CHECK (payment_amount_pence IS NULL OR payment_amount_pence > 0),
			payday_anchor_date TEXT NOT NULL,
			cycle_days INTEGER NOT NULL DEFAULT 28 CHECK (cycle_days = 28),
			cycle_type TEXT NOT NULL DEFAULT 'four_week' CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday')),
			secret TEXT,
			${ENCRYPTED_ROW_CHECK(['payment_amount_pence'])}
		);
	`);

	const currentSettingsColumns = await columnNames(client, 'app_settings');
	if (!currentSettingsColumns.has('cycle_type')) {
		await client.execute(`
			ALTER TABLE app_settings ADD COLUMN cycle_type TEXT NOT NULL DEFAULT 'four_week'
			CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday'))
		`);
	}

	// The take-home amount is encrypted alongside the expenses, so the same
	// nullable rebuild the expenses table needed applies here.
	if (!currentSettingsColumns.has('secret')) {
		await client.batch(
			[
				`CREATE TABLE app_settings_encrypted (
					profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
					payment_amount_pence INTEGER CHECK (payment_amount_pence IS NULL OR payment_amount_pence > 0),
					payday_anchor_date TEXT NOT NULL,
					cycle_days INTEGER NOT NULL DEFAULT 28 CHECK (cycle_days = 28),
					cycle_type TEXT NOT NULL DEFAULT 'four_week' CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday')),
					secret TEXT,
					${ENCRYPTED_ROW_CHECK(['payment_amount_pence'])}
				)`,
				`INSERT INTO app_settings_encrypted (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type)
				SELECT profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type FROM app_settings`,
				'DROP TABLE app_settings',
				'ALTER TABLE app_settings_encrypted RENAME TO app_settings'
			],
			'write'
		);
	}

	await client.executeMultiple(`
		INSERT OR IGNORE INTO app_settings (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type)
		VALUES (1, 200000, '2026-07-15', 28, 'four_week');
		DROP INDEX IF EXISTS idx_expenses_active_due_date;
		DROP INDEX IF EXISTS idx_expenses_unique_charge;
		DROP INDEX IF EXISTS idx_expenses_profile_unique_charge;
		CREATE INDEX IF NOT EXISTS idx_expenses_profile_active_due_date ON expenses(profile_id, active, next_due_date);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_profile_unique_charge ON expenses(profile_id, name, next_due_date, amount_pence) WHERE secret IS NULL;
	`);
	await tryPragma(client, 'foreign_keys = ON');
}
