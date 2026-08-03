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

export type Profile = { id: number; name: string; avatar_color: string };

export type UsagePoint = { date: string; total: number; event?: string };
export type UsageForecast = { points: UsagePoint[]; start: string; end: string };
export type PaymentCycleType = 'four_week' | 'monthly' | 'last_friday';
export type AppSettings = {
	payment_amount_pence: number;
	payday_anchor_date: string;
	cycle_days: number;
	cycle_type: PaymentCycleType;
};
