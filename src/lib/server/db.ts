import Database from 'better-sqlite3';
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

const dataDir = process.env.LEDGERLY_DATA_DIR ?? join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });
const db = new Database(join(dataDir, 'expenses.db'));
initializeSchema(db);

export default db;
