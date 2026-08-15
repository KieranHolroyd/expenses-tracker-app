import { queryOne } from './db';
import type { AuthContext } from './auth';
import { advancePastDueExpenses } from './due-dates';
import { expensesFor } from './expenses';
import { requireUnlockedProfile } from './profile';
import { openSettings, type SettingsRow } from './secure';
import { openExpenses } from './secure';

const SETTINGS_SQL =
	'SELECT payment_amount_pence, payday_anchor_date, cycle_days, cycle_type, secret FROM app_settings WHERE profile_id = ?';

/**
 * Everything a signed-in page needs about the current profile: the decrypted
 * rows and settings, with past-due dates rolled forward first so every reader
 * sees the same anchor dates. Shared by the dashboard and the deep dives, which
 * differ only in what they derive from it.
 */
export async function loadLedger(context: AuthContext) {
	const { profile, key } = await requireUnlockedProfile(context);
	await advancePastDueExpenses(profile.id);
	const expenses = openExpenses(key, await expensesFor(profile.id));
	const settings = openSettings(key, (await queryOne<SettingsRow>(SETTINGS_SQL, [profile.id]))!);
	return { profile, expenses, settings };
}
