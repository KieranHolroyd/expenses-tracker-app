import { annualCost, monthlyCost } from '$lib/format';
import type {
	AppSettings,
	CategoryStat,
	Expense,
	ExpenseStats,
	MonthProjection,
	ProjectedCharge
} from '$lib/types';
import { dateForMonth, iso, startOfTodayUtc, utcDate } from './due-dates';

const DAY_MS = 86_400_000;
const PROJECTION_MONTHS = 12;
const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/** Four-week schedules pay 13 times a year; the calendar schedules pay 12. */
export const periodsPerYear = (settings: AppSettings) =>
	settings.cycle_type === 'four_week' ? 13 : 12;

function median(values: number[]) {
	if (!values.length) return 0;
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[], mean: number) {
	if (values.length < 2) return 0;
	const variance =
		values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
	return Math.sqrt(variance);
}

/** The 12 calendar months starting with the one containing `today`. */
function projectionWindow(today: Date) {
	const base = startOfTodayUtc(today);
	return Array.from({ length: PROJECTION_MONTHS }, (_, index) => {
		const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + index, 1));
		return { year: first.getUTCFullYear(), month: first.getUTCMonth() };
	});
}

/**
 * When an expense falls due inside a given calendar month, or null if it doesn't.
 * A monthly expense lands in every month on its anchor day; a yearly one only in
 * its anchor month, which a 12-month window contains exactly once.
 */
function chargeDateInMonth(expense: Expense, year: number, month: number) {
	const anchor = utcDate(expense.next_due_date);
	if (expense.cadence === 'Yearly' && anchor.getUTCMonth() !== month) return null;
	return dateForMonth(year, month, anchor.getUTCDate());
}

function buildProjection(active: Expense[], today: Date) {
	const todayIso = iso(startOfTodayUtc(today));
	const months: MonthProjection[] = projectionWindow(today).map(({ year, month }) => {
		const charges: ProjectedCharge[] = [];
		for (const expense of active) {
			const date = chargeDateInMonth(expense, year, month);
			if (!date) continue;
			charges.push({
				name: expense.name,
				category: expense.category,
				cadence: expense.cadence,
				date: iso(date),
				amount: expense.amount_pence
			});
		}
		charges.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
		return {
			key: `${year}-${String(month + 1).padStart(2, '0')}`,
			label: MONTH_LABELS[month],
			year,
			total: charges.reduce((sum, charge) => sum + charge.amount, 0),
			renewals: charges
				.filter((charge) => charge.cadence === 'Yearly')
				.reduce((sum, charge) => sum + charge.amount, 0),
			elapsed: charges
				.filter((charge) => charge.date < todayIso)
				.reduce((sum, charge) => sum + charge.amount, 0),
			count: charges.length,
			charges
		};
	});

	const total = months.reduce((sum, month) => sum + month.total, 0);
	const ranked = months.toSorted((a, b) => a.total - b.total);
	const trough = ranked[0] ?? null;
	const peak = ranked.at(-1) ?? null;
	return {
		months,
		total,
		average: months.length ? total / months.length : 0,
		peak,
		trough,
		swing: peak && trough ? peak.total - trough.total : 0
	};
}

function buildCategories(active: Expense[], annual: number): CategoryStat[] {
	const grouped = new Map<string, Expense[]>();
	for (const expense of active) {
		grouped.set(expense.category, [...(grouped.get(expense.category) ?? []), expense]);
	}
	return [...grouped.entries()]
		.map(([name, items]) => {
			const categoryAnnual = items.reduce((sum, item) => sum + annualCost(item), 0);
			const largest = items.toSorted((a, b) => annualCost(b) - annualCost(a))[0];
			return {
				name,
				count: items.length,
				monthly: items.reduce((sum, item) => sum + monthlyCost(item), 0),
				annual: categoryAnnual,
				share: annual ? categoryAnnual / annual : 0,
				largest: largest ? { name: largest.name, annual: annualCost(largest) } : null
			};
		})
		.sort((a, b) => b.annual - a.annual);
}

export function buildStats(
	expenses: Expense[],
	settings: AppSettings,
	today = new Date()
): ExpenseStats {
	const active = expenses.filter((expense) => expense.active);
	const inactive = expenses.filter((expense) => !expense.active);
	const annual = active.reduce((sum, expense) => sum + annualCost(expense), 0);
	const annualCosts = active.map(annualCost).toSorted((a, b) => b - a);
	const monthlyCosts = active.map(monthlyCost);
	const mean = monthlyCosts.length
		? monthlyCosts.reduce((a, b) => a + b, 0) / monthlyCosts.length
		: 0;
	const byAnnual = active.toSorted((a, b) => annualCost(b) - annualCost(a));

	const cycles = periodsPerYear(settings);
	const incomeAnnual = settings.payment_amount_pence * cycles;
	const projection = buildProjection(active, today);

	const todayUtc = startOfTodayUtc(today);
	const todayIso = iso(todayUtc);
	const upcomingCharges = projection.months
		.flatMap((month) => month.charges)
		.filter((charge) => charge.date >= todayIso)
		.sort((a, b) => a.date.localeCompare(b.date));
	const within = (days: number) => {
		const limit = iso(new Date(todayUtc.getTime() + days * DAY_MS));
		return upcomingCharges
			.filter((charge) => charge.date <= limit)
			.reduce((sum, charge) => sum + charge.amount, 0);
	};

	const hhi = annual ? annualCosts.reduce((sum, cost) => sum + (cost / annual) ** 2, 0) : 0;
	const renewalCharges = upcomingCharges.filter((charge) => charge.cadence === 'Yearly');

	return {
		counts: {
			total: expenses.length,
			active: active.length,
			paused: inactive.length,
			monthly: active.filter((expense) => expense.cadence === 'Monthly').length,
			yearly: active.filter((expense) => expense.cadence === 'Yearly').length
		},
		totals: {
			annual,
			monthly: annual / 12,
			weekly: annual / 52,
			daily: annual / 365,
			perCycle: annual / cycles
		},
		paused: {
			count: inactive.length,
			annual: inactive.reduce((sum, expense) => sum + annualCost(expense), 0)
		},
		cadenceMix: {
			monthlyBilled: active
				.filter((expense) => expense.cadence === 'Monthly')
				.reduce((sum, expense) => sum + annualCost(expense), 0),
			yearlyBilled: active
				.filter((expense) => expense.cadence === 'Yearly')
				.reduce((sum, expense) => sum + annualCost(expense), 0),
			yearlyShare: annual
				? active
						.filter((expense) => expense.cadence === 'Yearly')
						.reduce((sum, expense) => sum + annualCost(expense), 0) / annual
				: 0
		},
		distribution: {
			mean,
			median: median(monthlyCosts),
			stdDev: standardDeviation(monthlyCosts, mean),
			min: monthlyCosts.length ? Math.min(...monthlyCosts) : 0,
			max: monthlyCosts.length ? Math.max(...monthlyCosts) : 0,
			largest: byAnnual[0] ?? null,
			smallest: byAnnual.at(-1) ?? null
		},
		concentration: {
			topShare: annual ? (annualCosts[0] ?? 0) / annual : 0,
			top3Share: annual ? annualCosts.slice(0, 3).reduce((a, b) => a + b, 0) / annual : 0,
			hhi,
			effectiveCount: hhi ? 1 / hhi : 0
		},
		categories: buildCategories(active, annual),
		projection,
		upcoming: {
			next7: within(7),
			next30: within(30),
			next90: within(90),
			charges: upcomingCharges.slice(0, 8)
		},
		renewals: {
			count: renewalCharges.length,
			annual: renewalCharges.reduce((sum, charge) => sum + charge.amount, 0),
			charges: renewalCharges
		},
		income: {
			annual: incomeAnnual,
			perCycle: settings.payment_amount_pence,
			periodsPerYear: cycles,
			committedShare: incomeAnnual ? annual / incomeAnnual : 0,
			free: incomeAnnual - annual
		},
		generatedOn: todayIso
	};
}
