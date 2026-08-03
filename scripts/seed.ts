import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expenseSeed, initializeSchema } from '../src/lib/server/schema';

const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });
const db = new Database(join(dataDir, 'expenses.db'));
initializeSchema(db);

const upsert = db.prepare(`
	INSERT INTO expenses (profile_id, name, category, amount_pence, cadence, next_due_date)
	VALUES (1, ?, ?, ?, ?, ?)
	ON CONFLICT(profile_id, name, next_due_date, amount_pence) DO UPDATE SET
		category = excluded.category,
		cadence = excluded.cadence,
		active = 1
`);
db.transaction(() => expenseSeed.forEach((row) => upsert.run(...row)))();
db.pragma('optimize');
console.log(`Seeded ${expenseSeed.length} recurring expenses into data/expenses.db`);
db.close();
