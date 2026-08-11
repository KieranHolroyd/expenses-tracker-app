import { expensesToCsv, exportFilename } from '$lib/server/csv';
import { advancePastDueExpenses } from '$lib/server/due-dates';
import { requireUnlockedProfile } from '$lib/server/profile';
import { openExpenses } from '$lib/server/secure';
import { expensesFor } from '../../+page.server';
import type { RequestHandler } from './$types';

/** Note that the download itself is plaintext CSV, whatever the profile's passcode state. */
export const GET: RequestHandler = async ({ cookies }) => {
	const { profile, key } = await requireUnlockedProfile(cookies);
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
