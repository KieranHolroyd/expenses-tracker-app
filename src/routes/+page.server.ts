import { fail, redirect } from '@sveltejs/kit';
import type { InStatement } from '@libsql/client';
import { batch, execute, queryOne, rewriteStorage } from '$lib/server/db';
import {
	PASSCODE_PATTERN,
	newDataKey,
	newSalt,
	unwrapDataKey,
	wrapDataKey
} from '$lib/server/crypto';
import { advancePastDueExpenses } from '$lib/server/due-dates';
import { expensesFor } from '$lib/server/expenses';
import { buildUsage } from '$lib/server/forecast';
import {
	clearFailures,
	endUnlockSession,
	forgetProfileSessions,
	recordFailure,
	startUnlockSession,
	throttledFor
} from '$lib/server/lock';
import { requireProfile, requireUnlockedProfile } from '$lib/server/profile';
import {
	openExpense,
	openExpenses,
	openSettings,
	sealExpense,
	sealPaymentAmount,
	type SettingsRow
} from '$lib/server/secure';
import { buildStats } from '$lib/server/stats';
import type { PaymentCycleType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import { parse } from 'csv-parse/sync';

const cycleTypes: PaymentCycleType[] = ['four_week', 'monthly', 'last_friday'];

function expenseFields(form: FormData) {
	const name = String(form.get('name') ?? '').trim();
	const category = String(form.get('category') ?? '').trim();
	const amount = Number(form.get('amount'));
	const cadence = String(form.get('cadence'));
	const nextDueDate = String(form.get('next_due_date'));
	const valid =
		name.length > 0 &&
		category.length > 0 &&
		Number.isFinite(amount) &&
		amount > 0 &&
		['Monthly', 'Yearly'].includes(cadence) &&
		/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate);

	return {
		valid,
		name,
		category,
		amountPence: Math.round(amount * 100),
		cadence,
		nextDueDate
	};
}

type ImportedExpense = {
	name: string;
	category: string;
	amount_pence: number;
	cadence: 'Monthly' | 'Yearly';
	next_due_date: string;
	active: number;
};

/** The same identity the unique index gives an unencrypted charge. */
const chargeKey = (expense: { name: string; next_due_date: string; amount_pence: number }) =>
	`${expense.name}\u0000${expense.next_due_date}\u0000${expense.amount_pence}`;

export const load: PageServerLoad = async ({ url, cookies }) => {
	if (url.pathname === '/') redirect(307, '/profiles');
	const { profile, key } = await requireUnlockedProfile(cookies);
	await advancePastDueExpenses(profile.id);
	const expenses = openExpenses(key, await expensesFor(profile.id));
	const settings = openSettings(
		key,
		(await queryOne<SettingsRow>(
			'SELECT payment_amount_pence, payday_anchor_date, cycle_days, cycle_type, secret FROM app_settings WHERE profile_id = ?',
			[profile.id]
		))!
	);
	return {
		expenses,
		usage: buildUsage(expenses, settings),
		stats: buildStats(expenses, settings),
		settings,
		profile
	};
};

export const actions: Actions = {
	add: async ({ request, cookies }) => {
		const { profile, key } = await requireUnlockedProfile(cookies);
		const fields = expenseFields(await request.formData());
		if (!fields.valid) {
			return fail(400, { message: 'Please complete every field with a valid value.' });
		}
		const sealed = sealExpense(key, {
			name: fields.name,
			category: fields.category,
			amount_pence: fields.amountPence
		});
		await execute(
			'INSERT INTO expenses (profile_id, name, category, amount_pence, secret, cadence, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[
				profile.id,
				sealed.name,
				sealed.category,
				sealed.amount_pence,
				sealed.secret,
				fields.cadence,
				fields.nextDueDate
			]
		);
		return { success: true };
	},
	edit: async ({ request, cookies }) => {
		const { profile, key } = await requireUnlockedProfile(cookies);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const fields = expenseFields(form);
		if (!Number.isInteger(id) || !fields.valid) {
			return fail(400, { message: 'Please complete every field with a valid value.' });
		}
		const sealed = sealExpense(key, {
			name: fields.name,
			category: fields.category,
			amount_pence: fields.amountPence
		});
		const result = await execute(
			'UPDATE expenses SET name = ?, category = ?, amount_pence = ?, secret = ?, cadence = ?, next_due_date = ? WHERE id = ? AND profile_id = ?',
			[
				sealed.name,
				sealed.category,
				sealed.amount_pence,
				sealed.secret,
				fields.cadence,
				fields.nextDueDate,
				id,
				profile.id
			]
		);
		if (!result.rowsAffected) return fail(404, { message: 'That expense could not be found.' });
		return { message: `${fields.name} updated.` };
	},
	toggle: async ({ request, cookies }) => {
		const { profile } = await requireUnlockedProfile(cookies);
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400);
		await execute(
			'UPDATE expenses SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND profile_id = ?',
			[id, profile.id]
		);
		return { success: true };
	},
	delete: async ({ request, cookies }) => {
		const { profile } = await requireUnlockedProfile(cookies);
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400);
		await execute('DELETE FROM expenses WHERE id = ? AND profile_id = ?', [id, profile.id]);
		return { success: true };
	},
	import: async ({ request, cookies }) => {
		const { profile, key } = await requireUnlockedProfile(cookies);
		const upload = (await request.formData()).get('csv');
		if (!(upload instanceof File) || !upload.size)
			return fail(400, { message: 'Choose a CSV file to import.' });
		if (upload.size > 2_000_000)
			return fail(413, { message: 'CSV files must be smaller than 2 MB.' });

		let rows: string[][];
		try {
			rows = parse(await upload.text(), {
				skip_empty_lines: true,
				relax_column_count: true,
				trim: true
			});
		} catch {
			return fail(400, { message: 'That file could not be read as CSV.' });
		}
		const headerIndex = rows.findIndex(
			(row) =>
				row.some((cell) => cell.toLowerCase() === 'description') &&
				row.some((cell) => cell.toLowerCase() === 'amount')
		);
		if (headerIndex < 0) return fail(400, { message: 'CSV needs Description and Amount columns.' });
		const headers = rows[headerIndex].map((cell) => cell.toLowerCase());
		const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
		const descriptionIndex = indexOf('description', 'name', 'expense');
		const amountIndex = indexOf('amount', 'cost');
		const categoryIndex = indexOf('category');
		const cadenceIndex = indexOf('recurring period', 'cadence', 'frequency');
		const typeIndex = indexOf('type');
		const statusIndex = indexOf('status', 'active');
		const dateIndices = headers
			.map((header, index) =>
				header === 'date' || header === 'next charge' || header === 'next_due_date' ? index : -1
			)
			.filter((index) => index >= 0);
		const today = new Date().toISOString().slice(0, 10);
		// Last row wins on a repeated charge, which is what the database's own
		// ON CONFLICT does — and the only dedupe available once names are ciphertext.
		const incoming = new Map<string, ImportedExpense>();
		for (const row of rows.slice(headerIndex + 1)) {
			const name = row[descriptionIndex]?.trim();
			const amount = Number((row[amountIndex] ?? '').replace(/[^0-9.-]/g, ''));
			if (!name || !Number.isFinite(amount) || amount <= 0) continue;
			if (typeIndex >= 0 && row[typeIndex] && !row[typeIndex].toLowerCase().includes('recurring'))
				continue;
			const rawCadence = cadenceIndex >= 0 ? row[cadenceIndex]?.toLowerCase() : 'monthly';
			const cadence = rawCadence?.includes('year') ? 'Yearly' : 'Monthly';
			const date =
				dateIndices
					.map((index) => row[index])
					.find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) ?? today;
			// Our own exports carry a Status column, so a round trip keeps paused rows paused.
			const status = statusIndex >= 0 ? row[statusIndex]?.toLowerCase().trim() : undefined;
			const active = status && ['paused', 'inactive', 'no', 'false', '0'].includes(status) ? 0 : 1;
			const parsed: ImportedExpense = {
				name,
				category: row[categoryIndex]?.trim() || 'Other',
				amount_pence: Math.round(amount * 100),
				cadence,
				next_due_date: date,
				active
			};
			incoming.set(chargeKey(parsed), parsed);
		}
		if (!incoming.size)
			return fail(400, { message: 'No recurring expense rows were found in that CSV.' });

		const statements: InStatement[] = [];
		if (key) {
			// Ciphertext cannot collide usefully, so the encrypted profile's existing
			// charges are matched in memory and updated by id instead of upserted.
			const existing = new Map(
				openExpenses(key, await expensesFor(profile.id)).map((expense) => [
					chargeKey(expense),
					expense.id
				])
			);
			for (const [charge, parsed] of incoming) {
				const sealed = sealExpense(key, parsed);
				const id = existing.get(charge);
				statements.push(
					id
						? {
								sql: 'UPDATE expenses SET secret = ?, cadence = ?, active = ? WHERE id = ? AND profile_id = ?',
								args: [sealed.secret, parsed.cadence, parsed.active, id, profile.id]
							}
						: {
								sql: 'INSERT INTO expenses (profile_id, name, category, amount_pence, secret, cadence, next_due_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
								args: [
									profile.id,
									null,
									null,
									null,
									sealed.secret,
									parsed.cadence,
									parsed.next_due_date,
									parsed.active
								]
							}
				);
			}
		} else {
			const upsert = `
				INSERT INTO expenses (profile_id, name, category, amount_pence, cadence, next_due_date, active)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(profile_id, name, next_due_date, amount_pence) WHERE secret IS NULL
				DO UPDATE SET category = excluded.category, cadence = excluded.cadence, active = excluded.active
			`;
			for (const parsed of incoming.values()) {
				statements.push({
					sql: upsert,
					args: [
						profile.id,
						parsed.name,
						parsed.category,
						parsed.amount_pence,
						parsed.cadence,
						parsed.next_due_date,
						parsed.active
					]
				});
			}
		}
		// A single batch keeps the import atomic, as the old transaction did.
		await batch(statements);
		const imported = statements.length;
		return { imported, message: `${imported} recurring expenses imported.` };
	},
	settings: async ({ request, cookies }) => {
		const { profile, key } = await requireUnlockedProfile(cookies);
		const form = await request.formData();
		const amount = Number(form.get('payment_amount'));
		const anchor = String(form.get('payday_anchor_date') ?? '');
		const cycleType = String(form.get('cycle_type')) as PaymentCycleType;
		if (
			!Number.isFinite(amount) ||
			amount <= 0 ||
			!/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
			!cycleTypes.includes(cycleType)
		) {
			return fail(400, { message: 'Enter a valid payment amount, schedule and payday.' });
		}
		const sealed = sealPaymentAmount(key, Math.round(amount * 100));
		await execute(
			'UPDATE app_settings SET payment_amount_pence = ?, secret = ?, payday_anchor_date = ?, cycle_type = ? WHERE profile_id = ?',
			[sealed.payment_amount_pence, sealed.secret, anchor, cycleType, profile.id]
		);
		return { message: 'Payment schedule updated.' };
	},
	setPasscode: async ({ request, cookies }) => {
		const record = await requireProfile(cookies);
		const form = await request.formData();
		const passcode = String(form.get('passcode') ?? '');
		const confirmation = String(form.get('confirm') ?? '');

		if (record.passcode_key) return fail(400, { message: 'This profile already has a passcode.' });
		if (!PASSCODE_PATTERN.test(passcode))
			return fail(400, { message: 'The passcode must be exactly 4 digits.' });
		if (passcode !== confirmation)
			return fail(400, { message: 'The two passcodes did not match.' });
		// Deliberately server-side as well as in the dialog: there is no recovery
		// path, so nothing gets encrypted until the warning has been acknowledged.
		if (!form.get('acknowledged'))
			return fail(400, {
				message: 'Please confirm you understand that a forgotten passcode cannot be recovered.'
			});

		const salt = newSalt();
		const dataKey = newDataKey();
		const wrapped = await wrapDataKey(passcode, salt, dataKey);

		const expenses = await expensesFor(record.id);
		const settings = (await queryOne<SettingsRow>(
			'SELECT payment_amount_pence, payday_anchor_date, cycle_days, cycle_type, secret FROM app_settings WHERE profile_id = ?',
			[record.id]
		))!;

		const statements: InStatement[] = expenses.map((row) => {
			const sealed = sealExpense(dataKey, openExpense(null, row));
			return {
				sql: 'UPDATE expenses SET name = NULL, category = NULL, amount_pence = NULL, secret = ? WHERE id = ? AND profile_id = ?',
				args: [sealed.secret, row.id, record.id]
			};
		});
		statements.push(
			{
				sql: 'UPDATE app_settings SET payment_amount_pence = NULL, secret = ? WHERE profile_id = ?',
				args: [
					sealPaymentAmount(dataKey, openSettings(null, settings).payment_amount_pence).secret,
					record.id
				]
			},
			{
				sql: 'UPDATE profiles SET passcode_salt = ?, passcode_key = ? WHERE id = ?',
				args: [salt, wrapped, record.id]
			}
		);
		// One transaction: the rows and the key that opens them can never disagree.
		await batch(statements);
		await rewriteStorage();

		forgetProfileSessions(record.id);
		clearFailures(record.id);
		startUnlockSession(cookies, record.id, dataKey);
		return { message: 'Passcode set. This profile is now encrypted.' };
	},
	removePasscode: async ({ request, cookies }) => {
		const record = await requireProfile(cookies);
		if (!record.passcode_salt || !record.passcode_key)
			return fail(400, { message: 'This profile does not have a passcode.' });

		const waitFor = throttledFor(record.id);
		if (waitFor) return fail(429, { message: `Too many attempts. Try again in ${waitFor}s.` });

		const passcode = String((await request.formData()).get('passcode') ?? '');
		const dataKey = PASSCODE_PATTERN.test(passcode)
			? await unwrapDataKey(passcode, record.passcode_salt, record.passcode_key)
			: null;
		if (!dataKey) {
			const blocked = recordFailure(record.id);
			return fail(403, {
				message: blocked
					? `That passcode is not right. Try again in ${blocked}s.`
					: 'That passcode is not right.'
			});
		}

		const expenses = await expensesFor(record.id);
		const settings = (await queryOne<SettingsRow>(
			'SELECT payment_amount_pence, payday_anchor_date, cycle_days, cycle_type, secret FROM app_settings WHERE profile_id = ?',
			[record.id]
		))!;

		// Encrypted rows are not covered by the unique charge index, so a duplicate
		// could have crept in; one row is kept rather than failing the restore.
		const seen = new Set<string>();
		const statements: InStatement[] = [];
		for (const row of openExpenses(dataKey, expenses).reverse()) {
			const charge = chargeKey(row);
			statements.push(
				seen.has(charge)
					? {
							sql: 'DELETE FROM expenses WHERE id = ? AND profile_id = ?',
							args: [row.id, record.id]
						}
					: {
							sql: 'UPDATE expenses SET name = ?, category = ?, amount_pence = ?, secret = NULL WHERE id = ? AND profile_id = ?',
							args: [row.name, row.category, row.amount_pence, row.id, record.id]
						}
			);
			seen.add(charge);
		}
		statements.push(
			{
				sql: 'UPDATE app_settings SET payment_amount_pence = ?, secret = NULL WHERE profile_id = ?',
				args: [openSettings(dataKey, settings).payment_amount_pence, record.id]
			},
			{
				sql: 'UPDATE profiles SET passcode_salt = NULL, passcode_key = NULL WHERE id = ?',
				args: [record.id]
			}
		);
		await batch(statements);

		forgetProfileSessions(record.id);
		clearFailures(record.id);
		endUnlockSession(cookies);
		return { message: 'Passcode removed. This profile is no longer encrypted.' };
	},
	lock: async ({ cookies }) => {
		endUnlockSession(cookies);
		redirect(303, '/unlock');
	}
};
