import type { Expense } from './types';

export const money = (pence: number) =>
	new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
export const shortDate = (value: string) =>
	new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
		new Date(`${value}T00:00:00Z`)
	);
export const fullDate = (value: string) =>
	new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
		new Date(`${value}T00:00:00Z`)
	);
export const monthlyCost = (expense: Expense) =>
	expense.cadence === 'Yearly' ? expense.amount_pence / 12 : expense.amount_pence;
export const expensePalette: Record<string, string> = {
	Software: '#5968c5',
	Infrastructure: '#de735c',
	Entertainment: '#d7a542',
	Lifestyle: '#4b8c7c',
	Home: '#9a6fac',
	Other: '#718078'
};
