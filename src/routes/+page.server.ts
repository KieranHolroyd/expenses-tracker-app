import { fail, redirect } from '@sveltejs/kit';
import db, { type Expense } from '$lib/server/db';
import { advancePastDueExpenses } from '$lib/server/due-dates';
import { buildUsage } from '$lib/server/forecast';
import type { AppSettings, PaymentCycleType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import { parse } from 'csv-parse/sync';

type Profile = { id: number; name: string; avatar_color: string };
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

function requireProfile(cookies: { get: (name: string) => string | undefined }) {
	const id = Number(cookies.get('ledgerly_profile'));
	const profile = Number.isInteger(id)
		? (db.prepare('SELECT id, name, avatar_color FROM profiles WHERE id = ?').get(id) as
				Profile | undefined)
		: undefined;
	if (!profile) redirect(303, '/profiles');
	return profile;
}

export const load: PageServerLoad = ({ url, cookies }) => {
	if (url.pathname === '/') redirect(307, '/profiles');
	const profile = requireProfile(cookies);
	advancePastDueExpenses(db, profile.id);
	const expenses = db
		.prepare(
			'SELECT * FROM expenses WHERE profile_id = ? ORDER BY active DESC, next_due_date ASC, name ASC'
		)
		.all(profile.id) as Expense[];
	const settings = db
		.prepare(
			'SELECT payment_amount_pence, payday_anchor_date, cycle_days, cycle_type FROM app_settings WHERE profile_id = ?'
		)
		.get(profile.id) as AppSettings;
	return { expenses, usage: buildUsage(expenses, settings), settings, profile };
};

export const actions: Actions = {
	add: async ({ request, cookies }) => {
		const profile = requireProfile(cookies);
		const fields = expenseFields(await request.formData());
		if (!fields.valid) {
			return fail(400, { message: 'Please complete every field with a valid value.' });
		}
		db.prepare(
			'INSERT INTO expenses (profile_id, name, category, amount_pence, cadence, next_due_date) VALUES (?, ?, ?, ?, ?, ?)'
		).run(
			profile.id,
			fields.name,
			fields.category,
			fields.amountPence,
			fields.cadence,
			fields.nextDueDate
		);
		return { success: true };
	},
	edit: async ({ request, cookies }) => {
		const profile = requireProfile(cookies);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const fields = expenseFields(form);
		if (!Number.isInteger(id) || !fields.valid) {
			return fail(400, { message: 'Please complete every field with a valid value.' });
		}
		const result = db
			.prepare(
				'UPDATE expenses SET name = ?, category = ?, amount_pence = ?, cadence = ?, next_due_date = ? WHERE id = ? AND profile_id = ?'
			)
			.run(
				fields.name,
				fields.category,
				fields.amountPence,
				fields.cadence,
				fields.nextDueDate,
				id,
				profile.id
			);
		if (!result.changes) return fail(404, { message: 'That expense could not be found.' });
		return { message: `${fields.name} updated.` };
	},
	toggle: async ({ request, cookies }) => {
		const profile = requireProfile(cookies);
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400);
		db.prepare(
			'UPDATE expenses SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND profile_id = ?'
		).run(id, profile.id);
		return { success: true };
	},
	delete: async ({ request, cookies }) => {
		const profile = requireProfile(cookies);
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400);
		db.prepare('DELETE FROM expenses WHERE id = ? AND profile_id = ?').run(id, profile.id);
		return { success: true };
	},
	import: async ({ request, cookies }) => {
		const profile = requireProfile(cookies);
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
		const dateIndices = headers
			.map((header, index) =>
				header === 'date' || header === 'next charge' || header === 'next_due_date' ? index : -1
			)
			.filter((index) => index >= 0);
		const today = new Date().toISOString().slice(0, 10);
		const upsert = db.prepare(`
			INSERT INTO expenses (profile_id, name, category, amount_pence, cadence, next_due_date)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(profile_id, name, next_due_date, amount_pence) DO UPDATE SET category = excluded.category, cadence = excluded.cadence, active = 1
		`);
		let imported = 0;
		const importRows = db.transaction(() => {
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
				upsert.run(
					profile.id,
					name,
					row[categoryIndex]?.trim() || 'Other',
					Math.round(amount * 100),
					cadence,
					date
				);
				imported += 1;
			}
		});
		importRows();
		if (!imported)
			return fail(400, { message: 'No recurring expense rows were found in that CSV.' });
		db.pragma('optimize');
		return { imported, message: `${imported} recurring expenses imported.` };
	},
	settings: async ({ request, cookies }) => {
		const profile = requireProfile(cookies);
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
		db.prepare(
			'UPDATE app_settings SET payment_amount_pence = ?, payday_anchor_date = ?, cycle_type = ? WHERE profile_id = ?'
		).run(Math.round(amount * 100), anchor, cycleType, profile.id);
		return { message: 'Payment schedule updated.' };
	}
};
