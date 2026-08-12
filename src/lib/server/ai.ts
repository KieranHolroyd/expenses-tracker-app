import { env } from '$env/dynamic/private';
import type { Expense } from '$lib/types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-5.6-terra';
/** Enough headroom for a long list, small enough that one bad reply is cheap to retry. */
const BATCH_SIZE = 60;
const MIN_CATEGORIES = 3;
const MAX_CATEGORIES = 8;
/**
 * Roughly how many expenses each category should hold. Left to itself the model
 * gives almost every expense its own shade of category, so the ceiling is tied
 * to the size of the list: 20 expenses can have at most 5 categories, which
 * forces the near-duplicates to be merged rather than all kept.
 */
const EXPENSES_PER_CATEGORY = 4;

const categoryCeiling = (count: number) =>
	Math.max(MIN_CATEGORIES, Math.min(MAX_CATEGORIES, Math.ceil(count / EXPENSES_PER_CATEGORY)));

/** The model saw the expense but had nothing to say about it. */
export const FALLBACK_CATEGORY = 'Other';

export class AiError extends Error {}

// Read through `$env/dynamic/private` rather than `process.env`, so `.env` is
// picked up in development and the real environment wins in production.
const apiKey = () => env.OPENROUTER_API_KEY?.trim();
const model = () => env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;

/** Whether the feature can run at all, so the UI can hide the button rather than fail on it. */
export const aiConfigured = () => Boolean(apiKey());

/** What the model is shown: enough to judge what an expense is for, and nothing else. */
type Described = Pick<Expense, 'id' | 'name' | 'cadence' | 'amount_pence'>;

const describe = (expense: Described) =>
	`${expense.id}. ${expense.name} — £${(expense.amount_pence / 100).toFixed(2)} ${expense.cadence.toLowerCase()}`;

async function chat(system: string, user: string) {
	const key = apiKey();
	if (!key) throw new AiError('OPENROUTER_API_KEY is not set.');

	let response: Response;
	try {
		response = await fetch(ENDPOINT, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${key}`,
				'content-type': 'application/json',
				// OpenRouter attributes usage to these; both are optional and free-form.
				'http-referer': process.env.OPENROUTER_SITE_URL ?? 'https://ledgerly.local',
				'x-title': 'Ledgerly'
			},
			body: JSON.stringify({
				model: model(),
				temperature: 0,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user }
				]
			})
		});
	} catch (error) {
		throw new AiError(`Could not reach OpenRouter: ${(error as Error).message}`);
	}

	if (!response.ok) {
		const detail = (await response.text()).slice(0, 200);
		throw new AiError(`OpenRouter returned ${response.status}. ${detail}`);
	}
	const body = (await response.json()) as {
		choices?: { message?: { content?: string } }[];
		error?: { message?: string };
	};
	if (body.error) throw new AiError(body.error.message ?? 'OpenRouter rejected the request.');
	const content = body.choices?.[0]?.message?.content?.trim();
	if (!content) throw new AiError('OpenRouter returned an empty reply.');
	return content;
}

/**
 * Models like to wrap JSON in prose or a code fence even when told not to, so the
 * outermost array or object is dug out rather than trusting the whole reply.
 */
function parseJson<T>(reply: string): T {
	const fenced = reply.replace(/^```(?:json)?/i, '').replace(/```$/, '');
	const start = fenced.search(/[[{]/);
	const end = Math.max(fenced.lastIndexOf(']'), fenced.lastIndexOf('}'));
	if (start < 0 || end <= start) throw new AiError('The model did not reply with JSON.');
	try {
		return JSON.parse(fenced.slice(start, end + 1)) as T;
	} catch {
		throw new AiError('The model replied with JSON that could not be parsed.');
	}
}

const cleanName = (value: unknown) =>
	typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 40) : '';

/** Words that carry no meaning in a category name, so two names differing only by one are the same category. */
const FILLER =
	/\b(services?|software|subscriptions?|tools?|apps?|platforms?|providers?|plans?|products?|costs?|expenses?|bills?|spending|stuff|misc|general|personal|monthly|recurring)\b/g;

/**
 * "AI Services", "AI Tools" and "AI" all reduce to the same key. The model is
 * asked not to produce those in the first place, but it is much cheaper to fold
 * them here than to hope, and a fold only ever makes the taxonomy coarser.
 */
const categoryKey = (name: string) => {
	const stripped = name
		.toLowerCase()
		.replace(FILLER, ' ')
		.replace(/[^a-z ]/g, ' ')
		.trim();
	// Singulars, so "Home Utilities" and "Home Utility" collapse together too.
	return (stripped || name.toLowerCase()).replace(/(\w)s\b/g, '$1');
};

/**
 * Step one: read the whole list and decide what the category set should be. Done
 * as its own call so that every expense is filed against one considered taxonomy
 * rather than each row inventing a category of its own.
 */
export async function proposeCategories(expenses: Described[]): Promise<string[]> {
	const ceiling = categoryCeiling(expenses.length);
	const reply = await chat(
		`You group a person's recurring expenses into categories they will use to read a budget.

Propose the smallest set of categories that covers the whole list: at least ${MIN_CATEGORIES}, at most ${ceiling}.

What makes a good set:
- Each category groups spending that serves the same purpose in this person's life, not spending sold by the same kind of company. "Entertainment" is a purpose; "Streaming Platforms" is a vendor type.
- Categories must be mutually exclusive. If an expense could plausibly go in two of them, they are one category with two names — merge them.
- Never propose two categories that differ only by a filler word or a near-synonym. "AI Services" and "AI Tools" are one category. "Software" and "Apps" are one category. "Cloud Hosting" and "Infrastructure" are one category.
- Every category must be worth having: it should hold at least two expenses from the list, and roughly ${EXPENSES_PER_CATEGORY} on average. If a category would hold one expense, fold it into a broader one instead.
- Balance matters as much as merging: no category may hold more than a third of the list. If one would, split it along the line that tells this person the most about their spending.
- Prefer a category people already use for budgets (Software, Entertainment, Utilities, Transport, Health, Groceries, Insurance, Housing) over one invented for this list, unless the list really is dominated by something specific.
- Cover the whole list. Use "${FALLBACK_CATEGORY}" only for genuine leftovers, and never as a way to avoid deciding.

Format: Title Case, one or two words, no slashes, ampersands or parentheses.

Reply with a JSON array of strings and nothing else.`,
		expenses.map(describe).join('\n')
	);

	const seen = new Set<string>();
	const categories: string[] = [];
	for (const value of parseJson<unknown[]>(reply)) {
		const name = cleanName(value);
		const key = categoryKey(name);
		if (!name || seen.has(key)) continue;
		seen.add(key);
		categories.push(name);
	}
	if (categories.length < 2) throw new AiError('The model did not propose a usable category list.');
	return categories.slice(0, ceiling);
}

/**
 * Step two: file each expense under one of the categories from step one. Anything
 * the model invents, skips or mis-ids is dropped rather than written, so a sloppy
 * reply can only leave categories unchanged — never scramble them.
 */
export async function assignCategories(
	expenses: Described[],
	categories: string[]
): Promise<Map<number, string>> {
	// Keyed both ways, so a reply that says "AI Tools" where the list says
	// "AI Services" still lands in the right category instead of being dropped.
	const canonical = new Map<string, string>();
	for (const name of categories) {
		canonical.set(name.toLowerCase(), name);
		if (!canonical.has(categoryKey(name))) canonical.set(categoryKey(name), name);
	}
	const byId = new Map(expenses.map((expense) => [expense.id, expense]));
	const assignments = new Map<number, string>();

	for (let start = 0; start < expenses.length; start += BATCH_SIZE) {
		const batch = expenses.slice(start, start + BATCH_SIZE);
		const reply = await chat(
			`You file a person's recurring expenses into a fixed set of categories.

Categories: ${categories.join(', ')}.

Rules:
- Use only those categories, copied exactly. Never invent, rename or qualify one.
- Every listed expense gets exactly one category — the one matching what the person uses it for, not who sells it.
- When an expense could fit two categories, pick the broader one rather than the more specific.
- Each input line is "id. name — price". Reply with the same ids.

Reply with a JSON array of {"id": number, "category": string} objects and nothing else.`,
			batch.map(describe).join('\n')
		);

		for (const entry of parseJson<{ id?: unknown; category?: unknown }[]>(reply)) {
			const id = Number(entry?.id);
			const replied = cleanName(entry?.category);
			const category = canonical.get(replied.toLowerCase()) ?? canonical.get(categoryKey(replied));
			if (byId.has(id) && category) assignments.set(id, category);
		}
	}
	return assignments;
}

export type Categorisation = {
	/** The proposed categories that something was actually filed under. */
	categories: string[];
	/** Only the expenses whose category actually changes. */
	changes: { id: number; name: string; from: string; to: string }[];
	/** Expenses the model left out of its reply, so they keep the category they had. */
	skipped: number;
};

/** Both steps in order: propose the taxonomy, then apply it to every expense. */
export async function categoriseExpenses(expenses: Expense[]): Promise<Categorisation> {
	const described: Described[] = expenses.map(({ id, name, cadence, amount_pence }) => ({
		id,
		name,
		cadence,
		amount_pence
	}));
	const categories = await proposeCategories(described);
	const assignments = await assignCategories(described, categories);

	const changes = expenses
		.filter((expense) => {
			const next = assignments.get(expense.id);
			return next && next !== expense.category;
		})
		.map((expense) => ({
			id: expense.id,
			name: expense.name,
			from: expense.category,
			to: assignments.get(expense.id)!
		}));

	// A proposed category nobody was filed under is noise, so only the ones in
	// use are reported — in the order they were proposed.
	const used = new Set(assignments.values());
	return {
		categories: categories.filter((name) => used.has(name)),
		changes,
		skipped: expenses.length - assignments.size
	};
}
