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
/** Enough of an expense to price it, so projected charges work here as well as rows. */
type Priced = Pick<Expense, 'cadence' | 'amount_pence'>;
export const monthlyCost = (expense: Priced) =>
	expense.cadence === 'Yearly' ? expense.amount_pence / 12 : expense.amount_pence;
export const annualCost = (expense: Priced) =>
	expense.cadence === 'Yearly' ? expense.amount_pence : expense.amount_pence * 12;
export const percent = (fraction: number, digits = 0) =>
	new Intl.NumberFormat('en-GB', {
		style: 'percent',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(Number.isFinite(fraction) ? fraction : 0);
export const expensePalette: Record<string, string> = {
	Software: '#5968c5',
	Infrastructure: '#de735c',
	Entertainment: '#d7a542',
	Lifestyle: '#4b8c7c',
	Home: '#9a6fac',
	Other: '#718078'
};

/** The categories offered before anyone has typed one of their own. */
export const defaultCategories = Object.keys(expensePalette);

/**
 * Extra hues for categories people invent themselves. Picked to sit in the same
 * muted register as the built-in six and to stay distinguishable from each other
 * for the common forms of colour blindness.
 */
const extraPalette = [
	'#c2557f',
	'#3f7fa8',
	'#8a8f3d',
	'#b8663a',
	'#5d6ba0',
	'#3f8a76',
	'#a06a4f',
	'#7c5fa8'
];

/** FNV-1a, so a category keeps the same colour on every page and every device. */
function hash(value: string) {
	let result = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 0x01000193);
	}
	return result >>> 0;
}

/** The palette colour for a built-in category, or a stable one derived from the name. */
export const categoryColor = (name: string) =>
	expensePalette[name] ?? extraPalette[hash(name.toLowerCase()) % extraPalette.length];

/** URL-safe identity for a category name, since categories are free text with no id. */
export const categorySlug = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'uncategorised';
