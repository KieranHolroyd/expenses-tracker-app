import { decrypt, encrypt } from './crypto';
import type { AppSettings, Expense } from '$lib/types';

/**
 * Rows as they sit in the database: either the plaintext columns are filled in
 * and `secret` is null, or the reverse. Everything above this module works with
 * the decrypted {@link Expense}, so the rest of the app is unaware of either shape.
 */
export type ExpenseRow = Omit<Expense, 'name' | 'category' | 'amount_pence'> & {
	name: string | null;
	category: string | null;
	amount_pence: number | null;
	secret: string | null;
};

export type SettingsRow = Omit<AppSettings, 'payment_amount_pence'> & {
	payment_amount_pence: number | null;
	secret: string | null;
};

/** A locked profile reached a query that needs its data key; the caller should have redirected. */
export class LockedError extends Error {
	constructor() {
		super('This profile is locked.');
	}
}

type ExpenseFields = { name: string; category: string; amount_pence: number };

/**
 * Only what an expense costs and what it is for gets encrypted. The cadence, due
 * date and paused flag stay in the clear so the database can still index them
 * and roll past-due dates forward without holding the key.
 */
export function sealExpense(key: Buffer | null, fields: ExpenseFields) {
	// Picked field by field so that passing a whole expense in cannot bury a copy
	// of its due date inside the blob, where it would later go stale.
	const { name, category, amount_pence } = fields;
	if (!key) return { name, category, amount_pence, secret: null };
	return {
		name: null,
		category: null,
		amount_pence: null,
		secret: encrypt(key, JSON.stringify({ name, category, amount_pence }))
	};
}

export function openExpense(key: Buffer | null, row: ExpenseRow): Expense {
	const { secret, ...rest } = row;
	if (!secret) return rest as Expense;
	if (!key) throw new LockedError();
	const { name, category, amount_pence } = JSON.parse(decrypt(key, secret)) as ExpenseFields;
	return { ...rest, name, category, amount_pence };
}

/** Matches the SQL ordering, which cannot see through `secret` to sort by name. */
const byDueThenName = (a: Expense, b: Expense) =>
	b.active - a.active ||
	a.next_due_date.localeCompare(b.next_due_date) ||
	a.name.localeCompare(b.name);

export function openExpenses(key: Buffer | null, rows: ExpenseRow[]) {
	return rows.map((row) => openExpense(key, row)).sort(byDueThenName);
}

export function sealPaymentAmount(key: Buffer | null, amountPence: number) {
	return key
		? { payment_amount_pence: null, secret: encrypt(key, String(amountPence)) }
		: { payment_amount_pence: amountPence, secret: null };
}

export function openSettings(key: Buffer | null, row: SettingsRow): AppSettings {
	const { secret, ...rest } = row;
	if (!secret) return rest as AppSettings;
	if (!key) throw new LockedError();
	return { ...rest, payment_amount_pence: Number(decrypt(key, secret)) };
}
