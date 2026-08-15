import { error } from '@sveltejs/kit';
import { categoryDeepDive } from '$lib/server/deep-dive';
import { loadLedger } from '$lib/server/ledger';
import { buildStats } from '$lib/server/stats';
import type { PageServerLoad } from './$types';

// The dashboard's actions run here unchanged, so a row can be paused or edited
// from the deep dive without leaving it.
export { actions } from '../../../+page.server';

export const load: PageServerLoad = async (event) => {
	const { profile, expenses, settings } = await loadLedger(event);
	const detail = categoryDeepDive(expenses, settings, event.params.slug);
	if (!detail) error(404, 'No expenses are filed under that category.');
	return { profile, settings, detail, stats: buildStats(expenses, settings) };
};
