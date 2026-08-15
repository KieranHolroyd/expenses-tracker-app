import { expensesToCsv, exportFilename } from '$lib/server/csv';
import { advancePastDueExpenses } from '$lib/server/due-dates';
import { expensesFor } from '$lib/server/expenses';
import { requireUnlockedProfile } from '$lib/server/profile';
import { openExpenses } from '$lib/server/secure';
import type { RequestHandler } from './$types';

/** Note that the download itself is plaintext CSV, whatever the profile's passcode state. */
export const GET: RequestHandler = async (event) => {
	const { profile, key } = await requireUnlockedProfile(event);
	await advancePastDueExpenses(profile.id);
	const expenses = openExpenses(key, await expensesFor(profile.id));

	return new Response(expensesToCsv(expenses), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${exportFilename(profile.name)}"`,
			'cache-control': 'no-store'
		}
	});
};
