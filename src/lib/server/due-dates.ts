import type Database from 'better-sqlite3';

export const iso = (date: Date) => date.toISOString().slice(0, 10);

export function utcDate(value: string) {
	return new Date(`${value}T00:00:00Z`);
}

export function addMonths(date: Date, months: number) {
	const day = date.getUTCDate();
	const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
	const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
	next.setUTCDate(Math.min(day, lastDay));
	return next;
}

export function startOfTodayUtc(today = new Date()) {
	return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

export function nextDueOnOrAfter(
	stored: string,
	cadence: 'Monthly' | 'Yearly',
	today = new Date()
): string {
	let due = utcDate(stored);
	const step = cadence === 'Yearly' ? 12 : 1;
	const todayUtc = startOfTodayUtc(today);
	while (due < todayUtc) due = addMonths(due, step);
	return iso(due);
}

type PastDueExpense = {
	id: number;
	next_due_date: string;
	cadence: 'Monthly' | 'Yearly';
};

export function advancePastDueExpenses(
	db: Database.Database,
	profileId: number,
	today = new Date()
) {
	const todayIso = iso(startOfTodayUtc(today));
	const rows = db
		.prepare(
			`SELECT id, next_due_date, cadence FROM expenses
			 WHERE profile_id = ? AND active = 1 AND next_due_date < ?`
		)
		.all(profileId, todayIso) as PastDueExpense[];

	if (rows.length === 0) return;

	const update = db.prepare(
		'UPDATE expenses SET next_due_date = ? WHERE id = ? AND profile_id = ?'
	);

	db.transaction(() => {
		for (const row of rows) {
			const next = nextDueOnOrAfter(row.next_due_date, row.cadence, today);
			if (next !== row.next_due_date) update.run(next, row.id, profileId);
		}
	})();
}
