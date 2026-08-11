import process from 'node:process';
import type { InStatement } from '@libsql/client';
import { batch, close, databaseUrl } from '../src/lib/server/db';
import { expenseSeed } from '../src/lib/server/schema';

const upsert = `
	INSERT INTO expenses (profile_id, name, category, amount_pence, cadence, next_due_date)
	VALUES (1, ?, ?, ?, ?, ?)
	ON CONFLICT(profile_id, name, next_due_date, amount_pence) DO UPDATE SET
		category = excluded.category,
		cadence = excluded.cadence,
		active = 1
`;

async function seed() {
	const statements: InStatement[] = expenseSeed.map((row) => ({ sql: upsert, args: [...row] }));
	await batch(statements);
	console.log(`Seeded ${expenseSeed.length} recurring expenses into ${databaseUrl()}`);
	close();
}

seed().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
