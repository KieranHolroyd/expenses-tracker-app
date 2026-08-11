import { query } from './db';
import type { ExpenseRow } from './secure';

const COLUMNS =
	'id, profile_id, name, category, amount_pence, cadence, next_due_date, active, secret';

/**
 * Still ordered in SQL for unencrypted profiles; `openExpenses` re-sorts, because
 * an encrypted row has no name column for the database to order by.
 */
export const expensesFor = (profileId: number) =>
	query<ExpenseRow>(
		`SELECT ${COLUMNS} FROM expenses WHERE profile_id = ? ORDER BY active DESC, next_due_date ASC, name ASC`,
		[profileId]
	);
