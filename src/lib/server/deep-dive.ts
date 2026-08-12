import { annualCost, categorySlug, monthlyCost } from '$lib/format';
import type {
	AppSettings,
	CategoryDeepDive,
	CategoryStat,
	Expense,
	ExpenseDeepDive,
	RankedExpense
} from '$lib/types';
import { iso, startOfTodayUtc } from './due-dates';
import {
	buildCategories,
	buildProjection,
	commitmentSplit,
	groupByCategory,
	periodsPerYear,
	totalTrackedSpend,
	trackedSpend
} from './stats';

const byAnnualDesc = (a: Expense, b: Expense) => annualCost(b) - annualCost(a);

/**
 * Positions by annual cost, worked out once for the whole line-up so that a
 * deep dive can state where a single row sits without re-sorting per lookup.
 */
function rankings(active: Expense[]) {
	const overall = new Map(active.toSorted(byAnnualDesc).map((item, index) => [item.id, index + 1]));
	const inCategory = new Map<number, number>();
	for (const items of groupByCategory(active).values()) {
		items.toSorted(byAnnualDesc).forEach((item, index) => inCategory.set(item.id, index + 1));
	}
	return { overall, inCategory };
}

type Context = {
	annual: number;
	categoryAnnual: Map<string, number>;
	ranks: ReturnType<typeof rankings>;
	today: Date;
};

function rank(expense: Expense, context: Context): RankedExpense {
	const cost = annualCost(expense);
	const categoryTotal = context.categoryAnnual.get(expense.category) ?? 0;
	return {
		expense,
		monthly: monthlyCost(expense),
		annual: cost,
		shareOfTotal: context.annual ? cost / context.annual : 0,
		shareOfCategory: categoryTotal ? cost / categoryTotal : 0,
		// A paused expense is in no ranking, so it reports 0 rather than a position
		// it would only hold if it were switched back on.
		rank: context.ranks.overall.get(expense.id) ?? 0,
		rankInCategory: context.ranks.inCategory.get(expense.id) ?? 0,
		tracked: trackedSpend(expense, context.today)
	};
}

function contextFor(active: Expense[], today: Date): Context {
	return {
		annual: active.reduce((sum, expense) => sum + annualCost(expense), 0),
		categoryAnnual: new Map(
			[...groupByCategory(active).entries()].map(([name, items]) => [
				name,
				items.reduce((sum, item) => sum + annualCost(item), 0)
			])
		),
		ranks: rankings(active),
		today
	};
}

/** Categories are free text with no id, so the URL slug has to find its own name. */
function categoryNamed(expenses: Expense[], slug: string) {
	return [...new Set(expenses.map((expense) => expense.category))].find(
		(name) => categorySlug(name) === slug
	);
}

/** A placeholder stat line for a category whose expenses are all paused. */
const emptyStat = (name: string): CategoryStat => ({
	name,
	slug: categorySlug(name),
	count: 0,
	monthly: 0,
	annual: 0,
	share: 0,
	largest: null,
	average: 0,
	monthlyBilled: 0,
	yearlyBilled: 0,
	yearlyShare: 0,
	topShare: 0,
	vsAverageCategory: 0,
	commitment: { required: 0, optional: 0, requiredCount: 0, optionalCount: 0, requiredShare: 0 },
	nextCharge: null
});

export function categoryDeepDive(
	expenses: Expense[],
	settings: AppSettings,
	slug: string,
	today = new Date()
): CategoryDeepDive | null {
	const name = categoryNamed(expenses, slug);
	if (!name) return null;

	const active = expenses.filter((expense) => expense.active);
	const context = contextFor(active, today);
	const categories = buildCategories(active, context.annual);
	const category = categories.find((entry) => entry.name === name) ?? emptyStat(name);
	const position = categories.findIndex((entry) => entry.name === name);

	const items = active.filter((expense) => expense.category === name).sort(byAnnualDesc);
	const paused = expenses
		.filter((expense) => !expense.active && expense.category === name)
		.sort(byAnnualDesc);

	const months = buildProjection(items, today).months;
	const todayIso = iso(startOfTodayUtc(today));
	const cycles = periodsPerYear(settings);
	const income = settings.payment_amount_pence * cycles;

	return {
		category,
		rank: position < 0 ? categories.length + 1 : position + 1,
		categoryCount: categories.length,
		items: items.map((expense) => rank(expense, context)),
		paused: paused.map((expense) => rank(expense, context)),
		cadenceMix: {
			monthlyBilled: category.monthlyBilled,
			yearlyBilled: category.yearlyBilled,
			count: items.length,
			yearlyCount: items.filter((expense) => expense.cadence === 'Yearly').length
		},
		commitment: commitmentSplit(items),
		rates: {
			monthly: category.annual / 12,
			weekly: category.annual / 52,
			daily: category.annual / 365,
			perCycle: category.annual / cycles
		},
		shareOfIncome: income ? category.annual / income : 0,
		months,
		upcoming: months
			.flatMap((month) => month.charges)
			.filter((charge) => charge.date >= todayIso)
			.sort((a, b) => a.date.localeCompare(b.date))
			.slice(0, 10),
		tracked: totalTrackedSpend([...items, ...paused], today),
		generatedOn: todayIso
	};
}

export function expenseDeepDive(
	expenses: Expense[],
	settings: AppSettings,
	id: number,
	today = new Date()
): ExpenseDeepDive | null {
	const expense = expenses.find((entry) => entry.id === id);
	if (!expense) return null;

	const active = expenses.filter((entry) => entry.active);
	const context = contextFor(active, today);
	const categories = buildCategories(active, context.annual);
	const category =
		categories.find((entry) => entry.name === expense.category) ?? emptyStat(expense.category);

	const cost = annualCost(expense);
	const cycles = periodsPerYear(settings);
	const income = settings.payment_amount_pence * cycles;
	const todayIso = iso(startOfTodayUtc(today));

	// How many of the cheapest expenses this one could pay for, which lands the
	// scale better than a bare percentage of the total.
	const cheapest = active
		.filter((entry) => entry.id !== expense.id)
		.toSorted((a, b) => annualCost(a) - annualCost(b));
	const outweighs: string[] = [];
	let covered = 0;
	for (const other of cheapest) {
		if (covered + annualCost(other) > cost) break;
		covered += annualCost(other);
		outweighs.push(other.name);
	}

	return {
		item: rank(expense, context),
		category,
		activeCount: active.length,
		rates: {
			annual: cost,
			monthly: monthlyCost(expense),
			weekly: cost / 52,
			daily: cost / 365,
			perCycle: cost / cycles
		},
		shareOfIncome: income ? cost / income : 0,
		schedule: buildProjection([expense], today)
			.months.flatMap((month) => month.charges)
			.sort((a, b) => a.date.localeCompare(b.date)),
		outranks: active.filter((entry) => annualCost(entry) < cost).length,
		outweighs: { count: outweighs.length, names: outweighs.slice(0, 5) },
		peers: active
			.filter((entry) => entry.category === expense.category && entry.id !== expense.id)
			.sort(byAnnualDesc)
			.map((entry) => rank(entry, context)),
		generatedOn: todayIso
	};
}
