import type { AppSettings, Expense, UsageForecast, UsagePoint } from '$lib/types';
import { addMonths, iso, utcDate } from './due-dates';

const DAY_MS = 86_400_000;
const FORECAST_CYCLES = 13;

function dateForMonth(year: number, month: number, day: number) {
	const first = new Date(Date.UTC(year, month, 1));
	const lastDay = new Date(
		Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
	).getUTCDate();
	return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay)));
}

function lastFriday(year: number, month: number) {
	const lastDay = new Date(Date.UTC(year, month + 1, 0));
	lastDay.setUTCDate(lastDay.getUTCDate() - ((lastDay.getUTCDay() - 5 + 7) % 7));
	return lastDay;
}

export function paymentDates(settings: AppSettings, today: Date, cycles = FORECAST_CYCLES): Date[] {
	const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

	if (settings.cycle_type === 'four_week') {
		let start = utcDate(settings.payday_anchor_date);
		while (start > day) start = new Date(start.getTime() - 28 * DAY_MS);
		while (start.getTime() + 28 * DAY_MS <= day.getTime()) {
			start = new Date(start.getTime() + 28 * DAY_MS);
		}
		return Array.from(
			{ length: cycles + 1 },
			(_, index) => new Date(start.getTime() + index * 28 * DAY_MS)
		);
	}

	let start: Date;
	if (settings.cycle_type === 'last_friday') {
		start = lastFriday(day.getUTCFullYear(), day.getUTCMonth());
		if (start > day) start = lastFriday(day.getUTCFullYear(), day.getUTCMonth() - 1);
		return Array.from({ length: cycles + 1 }, (_, index) =>
			lastFriday(start.getUTCFullYear(), start.getUTCMonth() + index)
		);
	}

	const anchorDay = utcDate(settings.payday_anchor_date).getUTCDate();
	start = dateForMonth(day.getUTCFullYear(), day.getUTCMonth(), anchorDay);
	if (start > day) start = dateForMonth(day.getUTCFullYear(), day.getUTCMonth() - 1, anchorDay);
	return Array.from({ length: cycles + 1 }, (_, index) =>
		dateForMonth(start.getUTCFullYear(), start.getUTCMonth() + index, anchorDay)
	);
}

export function buildUsage(
	expenses: Expense[],
	settings: AppSettings,
	today = new Date()
): UsageForecast {
	const paydays = paymentDates(settings, today);
	const start = paydays[0];
	const end = paydays.at(-1)!;
	const charges = new Map<string, Array<{ amount: number; name: string }>>();

	for (const expense of expenses.filter((item) => item.active)) {
		let due = utcDate(expense.next_due_date);
		const step = expense.cadence === 'Yearly' ? 12 : 1;
		while (due < start) due = addMonths(due, step);
		while (due <= end) {
			const date = iso(due);
			charges.set(date, [
				...(charges.get(date) ?? []),
				{ amount: expense.amount_pence, name: expense.name }
			]);
			due = addMonths(due, step);
		}
	}

	const paydaySet = new Set(paydays.slice(1).map(iso));
	const points: UsagePoint[] = [{ date: iso(start), total: 0, event: 'Payday' }];
	let total = 0;

	for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
		const date = iso(cursor);
		if (paydaySet.has(date)) {
			total = 0;
			points.push({ date, total, event: 'Payday' });
		}
		for (const charge of charges.get(date) ?? []) {
			total += charge.amount;
			points.push({ date, total, event: charge.name });
		}
	}

	return { points, start: iso(start), end: iso(end) };
}
