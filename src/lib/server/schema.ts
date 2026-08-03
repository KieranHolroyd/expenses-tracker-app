import type Database from 'better-sqlite3';

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

export function initializeSchema(db: Database.Database) {
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = OFF');
	db.exec(`
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
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
			cadence TEXT NOT NULL CHECK (cadence IN ('Monthly', 'Yearly')),
			next_due_date TEXT NOT NULL,
			active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`);

	const expenseColumns = db.pragma('table_info(expenses)') as Array<{ name: string }>;
	if (!expenseColumns.some((column) => column.name === 'profile_id')) {
		db.exec(
			'ALTER TABLE expenses ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profiles(id) ON DELETE CASCADE'
		);
	}

	const settingsColumns = db.pragma('table_info(app_settings)') as Array<{ name: string }>;
	if (settingsColumns.length && !settingsColumns.some((column) => column.name === 'profile_id')) {
		db.transaction(() => {
			db.exec(`
				CREATE TABLE app_settings_new (
					profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
					payment_amount_pence INTEGER NOT NULL CHECK (payment_amount_pence > 0),
					payday_anchor_date TEXT NOT NULL,
					cycle_days INTEGER NOT NULL DEFAULT 28 CHECK (cycle_days = 28),
					cycle_type TEXT NOT NULL DEFAULT 'four_week' CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday'))
				);
				INSERT INTO app_settings_new (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type)
				SELECT 1, payment_amount_pence, payday_anchor_date, cycle_days, 'four_week' FROM app_settings WHERE id = 1;
				DROP TABLE app_settings;
				ALTER TABLE app_settings_new RENAME TO app_settings;
			`);
		})();
	}

	db.exec(`
		CREATE TABLE IF NOT EXISTS app_settings (
			profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
			payment_amount_pence INTEGER NOT NULL CHECK (payment_amount_pence > 0),
			payday_anchor_date TEXT NOT NULL,
			cycle_days INTEGER NOT NULL DEFAULT 28 CHECK (cycle_days = 28),
			cycle_type TEXT NOT NULL DEFAULT 'four_week' CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday'))
		);
	`);

	const currentSettingsColumns = db.pragma('table_info(app_settings)') as Array<{ name: string }>;
	if (!currentSettingsColumns.some((column) => column.name === 'cycle_type')) {
		db.exec(`
			ALTER TABLE app_settings ADD COLUMN cycle_type TEXT NOT NULL DEFAULT 'four_week'
			CHECK (cycle_type IN ('four_week', 'monthly', 'last_friday'));
		`);
	}

	db.exec(`
		INSERT OR IGNORE INTO app_settings (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type)
		VALUES (1, 200000, '2026-07-15', 28, 'four_week');
		DROP INDEX IF EXISTS idx_expenses_active_due_date;
		DROP INDEX IF EXISTS idx_expenses_unique_charge;
		CREATE INDEX IF NOT EXISTS idx_expenses_profile_active_due_date ON expenses(profile_id, active, next_due_date);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_profile_unique_charge ON expenses(profile_id, name, next_due_date, amount_pence);
	`);
	db.pragma('foreign_keys = ON');
	db.pragma('optimize');
}
