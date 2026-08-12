import { annualCost, categorySlug, monthlyCost } from '$lib/format';
import type {
	AppSettings,
	CategoryStat,
	CommitmentSplit,
	CutCandidate,
	DayLoad,
	Expense,
	ExpenseStats,
	MonthProjection,
	ProjectedCharge,
	TrackedSpend
} from '$lib/types';
import { addMonths, dateForMonth, iso, startOfTodayUtc, utcDate } from './due-dates';

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

/**
 * The annual split between what has to be paid and what doesn't. Required is a
 * per-expense judgement the profile makes; nothing infers it, so an untouched
 * line-up reports every penny as optional.
 */
export function commitmentSplit(expenses: Expense[]): CommitmentSplit {
	const required = expenses.filter((expense) => expense.required);
	const optional = expenses.filter((expense) => !expense.required);
	const requiredAnnual = required.reduce((sum, expense) => sum + annualCost(expense), 0);
	const optionalAnnual = optional.reduce((sum, expense) => sum + annualCost(expense), 0);
	const total = requiredAnnual + optionalAnnual;
	return {
		required: requiredAnnual,
		optional: optionalAnnual,
		requiredCount: required.length,
		optionalCount: optional.length,
		requiredShare: total ? requiredAnnual / total : 0
	};
}

export function buildProjection(active: Expense[], today: Date) {
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
				amount: expense.amount_pence,
				required: Boolean(expense.required)
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
			required: charges
				.filter((charge) => charge.required)
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

/**
 * What an expense has actually cost since it was added, counted back from its
 * anchor date rather than projected forward. Ledgerly has no ledger of past
 * charges, so this is a reconstruction: it assumes the cadence and price have
 * held since the row was created, which is the most it can honestly claim.
 */
export function trackedSpend(expense: Expense, today = new Date()): TrackedSpend {
	const since = (expense.created_at ?? expense.next_due_date).slice(0, 10);
	const step = expense.cadence === 'Yearly' ? 12 : 1;
	const start = utcDate(since);
	const todayIso = iso(startOfTodayUtc(today));
	let charges = 0;
	// Walk back from the next charge; the first one on or after `since` is the
	// earliest this profile can account for.
	for (
		let cursor = addMonths(utcDate(expense.next_due_date), -step);
		cursor >= start && iso(cursor) <= todayIso;
		cursor = addMonths(cursor, -step)
	) {
		charges += 1;
	}
	return { total: charges * expense.amount_pence, charges, since };
}

export function totalTrackedSpend(expenses: Expense[], today = new Date()): TrackedSpend {
	return expenses.reduce<TrackedSpend>(
		(sum, expense) => {
			const spend = trackedSpend(expense, today);
			return {
				total: sum.total + spend.total,
				charges: sum.charges + spend.charges,
				since: !sum.since || (spend.since && spend.since < sum.since) ? spend.since : sum.since
			};
		},
		{ total: 0, charges: 0, since: null }
	);
}

/** Which day of the month the charges cluster on, over the whole projection. */
function buildChargeDays(months: MonthProjection[]) {
	const totals = new Map<number, DayLoad>();
	for (const month of months) {
		for (const charge of month.charges) {
			const day = Number(charge.date.slice(8, 10));
			const load = totals.get(day) ?? { day, amount: 0, count: 0 };
			totals.set(day, { day, amount: load.amount + charge.amount, count: load.count + 1 });
		}
	}
	const days = [...totals.values()].sort((a, b) => a.day - b.day);
	const heaviest = days.toSorted((a, b) => b.amount - a.amount)[0] ?? null;
	const thirds = [0, 0, 0];
	for (const load of days) thirds[load.day <= 10 ? 0 : load.day <= 20 ? 1 : 2] += load.amount;
	const busiest = thirds.indexOf(Math.max(...thirds));
	return {
		days,
		heaviest,
		busiestThird: ['the first third', 'the middle', 'the last third'][busiest]
	};
}

function buildCutCandidates(byAnnual: Expense[], annual: number): CutCandidate[] {
	let running = 0;
	return byAnnual.slice(0, 8).map((expense) => {
		const cost = annualCost(expense);
		running += cost;
		return {
			id: expense.id,
			name: expense.name,
			category: expense.category,
			required: Boolean(expense.required),
			annual: cost,
			share: annual ? cost / annual : 0,
			cumulativeShare: annual ? running / annual : 0
		};
	});
}

export function groupByCategory(expenses: Expense[]) {
	const grouped = new Map<string, Expense[]>();
	for (const expense of expenses) {
		grouped.set(expense.category, [...(grouped.get(expense.category) ?? []), expense]);
	}
	return grouped;
}

export function buildCategories(active: Expense[], annual: number): CategoryStat[] {
	const grouped = groupByCategory(active);
	// The comparison baseline is the mean category, not the mean expense, so a
	// category of one expensive thing still reads as a large category.
	const averageCategory = grouped.size ? annual / grouped.size : 0;
	return [...grouped.entries()]
		.map(([name, items]) => {
			const categoryAnnual = items.reduce((sum, item) => sum + annualCost(item), 0);
			const ranked = items.toSorted((a, b) => annualCost(b) - annualCost(a));
			const largest = ranked[0];
			const yearlyBilled = items
				.filter((item) => item.cadence === 'Yearly')
				.reduce((sum, item) => sum + annualCost(item), 0);
			const soonest = items.toSorted((a, b) => a.next_due_date.localeCompare(b.next_due_date))[0];
			return {
				name,
				slug: categorySlug(name),
				count: items.length,
				monthly: items.reduce((sum, item) => sum + monthlyCost(item), 0),
				annual: categoryAnnual,
				share: annual ? categoryAnnual / annual : 0,
				largest: largest ? { name: largest.name, annual: annualCost(largest) } : null,
				average: items.length ? categoryAnnual / items.length : 0,
				monthlyBilled: categoryAnnual - yearlyBilled,
				yearlyBilled,
				yearlyShare: categoryAnnual ? yearlyBilled / categoryAnnual : 0,
				topShare: categoryAnnual && largest ? annualCost(largest) / categoryAnnual : 0,
				vsAverageCategory: averageCategory ? categoryAnnual / averageCategory : 0,
				commitment: commitmentSplit(items),
				nextCharge: soonest
					? { name: soonest.name, date: soonest.next_due_date, amount: soonest.amount_pence }
					: null
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
	const categories = buildCategories(active, annual);
	const categoryHhi = categories.reduce((sum, category) => sum + category.share ** 2, 0);

	const commitment = commitmentSplit(active);
	const byRequired = projection.months.toSorted((a, b) => b.required - a.required);

	return {
		counts: {
			total: expenses.length,
			active: active.length,
			paused: inactive.length,
			monthly: active.filter((expense) => expense.cadence === 'Monthly').length,
			yearly: active.filter((expense) => expense.cadence === 'Yearly').length,
			required: commitment.requiredCount
		},
		totals: {
			annual,
			monthly: annual / 12,
			weekly: annual / 52,
			daily: annual / 365,
			perCycle: annual / cycles
		},
		commitment: {
			...commitment,
			rates: {
				monthly: commitment.required / 12,
				weekly: commitment.required / 52,
				daily: commitment.required / 365,
				perCycle: commitment.required / cycles
			},
			// A category with required spend and no optional spend is one where the
			// only lever left is renegotiating the price, not dropping a line.
			fixedCategories: categories
				.filter((category) => category.commitment.required > 0 && !category.commitment.optional)
				.map((category) => category.name),
			peakRequiredMonth: byRequired[0]?.required ? byRequired[0] : null
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
			effectiveCount: hhi ? 1 / hhi : 0,
			categoryEffectiveCount: categoryHhi ? 1 / categoryHhi : 0
		},
		categories,
		chargeDays: buildChargeDays(projection.months),
		cutCandidates: buildCutCandidates(byAnnual, annual),
		tracked: totalTrackedSpend(active, today),
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
			free: incomeAnnual - annual,
			requiredShare: incomeAnnual ? commitment.required / incomeAnnual : 0,
			afterRequired: incomeAnnual - commitment.required
		},
		generatedOn: todayIso
	};
}
