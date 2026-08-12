import type { Expense } from '$lib/types';
import { iso, startOfTodayUtc } from './due-dates';

/**
 * Column names chosen so an exported file feeds straight back into the CSV
 * importer — see the `import` action in src/routes/+page.server.ts.
 */
export const exportHeaders = [
	'Description',
	'Category',
	'Amount',
	'Recurring Period',
	'Next Charge',
	'Status',
	'Necessity'
];

const escape = (value: string) =>
	/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export function expensesToCsv(expenses: Expense[]) {
	const rows = expenses.map((expense) => [
		expense.name,
		expense.category,
		(expense.amount_pence / 100).toFixed(2),
		expense.cadence,
		expense.next_due_date,
		expense.active ? 'Active' : 'Paused',
		expense.required ? 'Required' : 'Optional'
	]);
	return [exportHeaders, ...rows].map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

export function exportFilename(profileName: string, today = new Date()) {
	const slug = profileName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `ledgerly-${slug || 'expenses'}-${iso(startOfTodayUtc(today))}.csv`;
}
