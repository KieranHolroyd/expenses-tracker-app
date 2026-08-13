export type Expense = {
	id: number;
	profile_id: number;
	name: string;
	category: string;
	amount_pence: number;
	cadence: 'Monthly' | 'Yearly';
	next_due_date: string;
	active: number;
	/** 1 when the expense is one you have to keep paying; 0 (the default) when it is discretionary. */
	required: number;
	/** When the row was added to Ledgerly — the start of what it can account for. */
	created_at: string;
};

export type Profile = {
	id: number;
	name: string;
	avatar_color: string;
	/** Whether this profile's rows are encrypted behind a passcode. */
	has_passcode: boolean;
};

export type UsagePoint = { date: string; total: number; event?: string };
export type UsageForecast = { points: UsagePoint[]; start: string; end: string };
export type PaymentCycleType = 'four_week' | 'monthly' | 'last_friday';
export type AppSettings = {
	payment_amount_pence: number;
	payday_anchor_date: string;
	cycle_days: number;
	cycle_type: PaymentCycleType;
};

/** A single dated charge produced by projecting an expense forward. */
export type ProjectedCharge = {
	name: string;
	category: string;
	cadence: 'Monthly' | 'Yearly';
	date: string;
	amount: number;
	/** Carried through from the expense so a projection can be split without re-joining rows. */
	required: boolean;
};

/** One calendar month of the 12-month projection. */
export type MonthProjection = {
	key: string;
	label: string;
	year: number;
	/** Everything charged in this calendar month, including days already past. */
	total: number;
	/** The portion of `total` from Yearly-cadence renewals. */
	renewals: number;
	/** The portion of `total` charged by expenses marked required. */
	required: number;
	/** The portion of `total` already charged before today (only ever the first month). */
	elapsed: number;
	count: number;
	charges: ProjectedCharge[];
};

/**
 * An annual total split by whether the expense is one you have to keep paying.
 * The required side is the floor a line-up cannot be cut below; the optional
 * side is what is actually available to trim.
 */
export type CommitmentSplit = {
	required: number;
	optional: number;
	requiredCount: number;
	optionalCount: number;
	/** Share of the annual total that is marked required, 0–1. */
	requiredShare: number;
};

export type CategoryStat = {
	name: string;
	/** URL-safe identity, since a category is free text with no row of its own. */
	slug: string;
	count: number;
	monthly: number;
	annual: number;
	/** Share of the annual committed total, 0–1. */
	share: number;
	largest: { name: string; annual: number } | null;
	/** Annual cost divided by the number of expenses in the category. */
	average: number;
	/** The annual total split by how the category is billed. */
	monthlyBilled: number;
	yearlyBilled: number;
	/** Share of the category billed as yearly lump sums, 0–1. */
	yearlyShare: number;
	/** Share of the category taken by its single largest expense, 0–1. */
	topShare: number;
	/** How the category's annual total compares to the average category, as a ratio. */
	vsAverageCategory: number;
	/** How much of the category you have to keep paying, and how much you don't. */
	commitment: CommitmentSplit;
	/** The soonest charge in this category, or null when everything is paused. */
	nextCharge: { name: string; date: string; amount: number } | null;
};

/** One day of the month, with everything that lands on it over the next year. */
export type DayLoad = { day: number; amount: number; count: number; required: number };

/** A run of upcoming days, priced whole and split by what has to be paid. */
export type SpendWindow = { total: number; required: number; optional: number; count: number };

/** An expense ranked by how much cancelling it would actually save. */
export type CutCandidate = {
	id: number;
	name: string;
	category: string;
	/** Required expenses are still listed, but as context rather than as things to drop. */
	required: boolean;
	annual: number;
	/** Share of the annual committed total, 0–1. */
	share: number;
	/** Share covered by this expense and everything above it, 0–1. */
	cumulativeShare: number;
};

/** What an expense has cost since it was added, which is all Ledgerly can vouch for. */
export type TrackedSpend = {
	total: number;
	charges: number;
	/** The oldest tracked expense's start date, or null when there are none. */
	since: string | null;
};

export type ExpenseStats = {
	counts: {
		total: number;
		active: number;
		paused: number;
		monthly: number;
		yearly: number;
		required: number;
	};
	/** Cadence-normalised commitment, i.e. what the current line-up costs over time. */
	totals: { annual: number; monthly: number; weekly: number; daily: number; perCycle: number };
	/** The annual total split into what has to be paid and what is discretionary. */
	commitment: CommitmentSplit & {
		/** The required side expressed the same ways as `totals`. */
		rates: { monthly: number; weekly: number; daily: number; perCycle: number };
		/** Categories with no optional spend at all, so nothing in them can be trimmed. */
		fixedCategories: string[];
		/** The 12-month projection's heaviest month, counting only required charges. */
		peakRequiredMonth: MonthProjection | null;
	};
	paused: { count: number; annual: number; required: number };
	/** How the annual total splits by how it is billed, not by when it is used. */
	cadenceMix: { monthlyBilled: number; yearlyBilled: number; yearlyShare: number };
	distribution: {
		mean: number;
		median: number;
		stdDev: number;
		min: number;
		max: number;
		largest: Expense | null;
		smallest: Expense | null;
	};
	/** Herfindahl-style concentration over annual cost per expense. */
	concentration: {
		topShare: number;
		top3Share: number;
		hhi: number;
		effectiveCount: number;
		/** The same measure over categories rather than individual expenses. */
		categoryEffectiveCount: number;
	};
	categories: CategoryStat[];
	/** Where in the month charges land, summed over the 12-month projection. */
	chargeDays: { days: DayLoad[]; heaviest: DayLoad | null; busiestThird: string };
	/** Ranked by annual cost, so the top of the list is where cuts pay off. */
	cutCandidates: CutCandidate[];
	/** Actual outlay since each expense was added, not a projection. */
	tracked: TrackedSpend;
	projection: {
		months: MonthProjection[];
		average: number;
		total: number;
		peak: MonthProjection | null;
		trough: MonthProjection | null;
		swing: number;
	};
	upcoming: {
		next7: SpendWindow;
		next30: SpendWindow;
		next90: SpendWindow;
		charges: ProjectedCharge[];
	};
	renewals: {
		count: number;
		annual: number;
		/** The portion of the renewals you have marked required, and how many. */
		required: number;
		requiredCount: number;
		charges: ProjectedCharge[];
	};
	income: {
		annual: number;
		perCycle: number;
		periodsPerYear: number;
		committedShare: number;
		free: number;
		/** Share of take-home pay taken by required expenses alone, 0–1. */
		requiredShare: number;
		/** What is left after the required expenses, i.e. before any optional ones. */
		afterRequired: number;
	};
	generatedOn: string;
};

/** An expense priced every way the deep dives need it, plus where it ranks. */
export type RankedExpense = {
	expense: Expense;
	monthly: number;
	annual: number;
	/** Share of the whole active annual commitment, 0–1. */
	shareOfTotal: number;
	/** Share of its own category's annual total, 0–1. */
	shareOfCategory: number;
	/** 1-based position by annual cost among active expenses. */
	rank: number;
	/** 1-based position by annual cost within its category. */
	rankInCategory: number;
	tracked: TrackedSpend;
};

export type CategoryDeepDive = {
	category: CategoryStat;
	/** 1-based position by annual cost among categories. */
	rank: number;
	categoryCount: number;
	items: RankedExpense[];
	paused: RankedExpense[];
	cadenceMix: { monthlyBilled: number; yearlyBilled: number; count: number; yearlyCount: number };
	/** How much of this category you have to keep paying, and how much you don't. */
	commitment: CommitmentSplit;
	rates: { monthly: number; weekly: number; daily: number; perCycle: number };
	/** Share of take-home pay this one category accounts for, 0–1. */
	shareOfIncome: number;
	/** The 12-month projection filtered to this category. */
	months: MonthProjection[];
	upcoming: ProjectedCharge[];
	tracked: TrackedSpend;
	generatedOn: string;
};

export type ExpenseDeepDive = {
	item: RankedExpense;
	category: CategoryStat;
	activeCount: number;
	rates: { annual: number; monthly: number; weekly: number; daily: number; perCycle: number };
	/** Share of take-home pay this one expense accounts for, 0–1. */
	shareOfIncome: number;
	/** Every date this expense is charged over the next 12 months. */
	schedule: ProjectedCharge[];
	/** How many active expenses cost less over a year than this one. */
	outranks: number;
	/** The cheapest expenses whose combined annual cost this one exceeds. */
	outweighs: { count: number; names: string[] };
	peers: RankedExpense[];
	generatedOn: string;
};
