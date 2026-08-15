import { error, fail, redirect } from '@sveltejs/kit';
import { PERMISSIONS } from '$lib/server/auth';
import { execute } from '$lib/server/db';
import { expenseDeepDive } from '$lib/server/deep-dive';
import { loadLedger } from '$lib/server/ledger';
import { requireUnlockedProfile } from '$lib/server/profile';
import { buildStats } from '$lib/server/stats';
import { actions as ledgerActions } from '../../../+page.server';
import type { Action, Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { profile, expenses, settings } = await loadLedger(event);
	const id = Number(event.params.id);
	const detail = Number.isInteger(id) ? expenseDeepDive(expenses, settings, id) : null;
	if (!detail) error(404, 'That expense could not be found.');
	return {
		profile,
		settings,
		detail,
		categories: [...new Set(expenses.map((expense) => expense.category))].sort(),
		stats: buildStats(expenses, settings)
	};
};

// Reused as-is from the dashboard. The cast only restates the route id in the
// phantom type parameter; an action never reads it, and both routes take the
// same form fields.
const { edit, toggle, toggleRequired } = ledgerActions as unknown as {
	edit: Action;
	toggle: Action;
	toggleRequired: Action;
};

export const actions: Actions = {
	edit,
	toggle,
	toggleRequired,
	/** Deleting from here would reload a page whose subject no longer exists. */
	delete: async (event) => {
		const { profile } = await requireUnlockedProfile(event, PERMISSIONS.write);
		const id = Number((await event.request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400);
		await execute('DELETE FROM expenses WHERE id = ? AND profile_id = ?', [id, profile.id]);
		redirect(303, '/insights');
	}
};
