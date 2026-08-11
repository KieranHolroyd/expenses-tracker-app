export type Expense = {
	id: number;
	profile_id: number;
	name: string;
	category: string;
	amount_pence: number;
	cadence: 'Monthly' | 'Yearly';
	next_due_date: string;
	active: number;
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
	/** The portion of `total` already charged before today (only ever the first month). */
	elapsed: number;
	count: number;
	charges: ProjectedCharge[];
};

export type CategoryStat = {
	name: string;
	count: number;
	monthly: number;
	annual: number;
	/** Share of the annual committed total, 0–1. */
	share: number;
	largest: { name: string; annual: number } | null;
};

export type ExpenseStats = {
	counts: { total: number; active: number; paused: number; monthly: number; yearly: number };
	/** Cadence-normalised commitment, i.e. what the current line-up costs over time. */
	totals: { annual: number; monthly: number; weekly: number; daily: number; perCycle: number };
	paused: { count: number; annual: number };
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
	concentration: { topShare: number; top3Share: number; hhi: number; effectiveCount: number };
	categories: CategoryStat[];
	projection: {
		months: MonthProjection[];
		average: number;
		total: number;
		peak: MonthProjection | null;
		trough: MonthProjection | null;
		swing: number;
	};
	upcoming: { next7: number; next30: number; next90: number; charges: ProjectedCharge[] };
	renewals: { count: number; annual: number; charges: ProjectedCharge[] };
	income: {
		annual: number;
		perCycle: number;
		periodsPerYear: number;
		committedShare: number;
		free: number;
	};
	generatedOn: string;
};
