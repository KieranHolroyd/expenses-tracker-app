import { fail, redirect } from '@sveltejs/kit';
import { PASSCODE_PATTERN, unwrapDataKey } from '$lib/server/crypto';
import {
	clearFailures,
	recordFailure,
	startUnlockSession,
	throttledFor,
	unlockedKey
} from '$lib/server/lock';
import { publicProfile, requireProfile } from '$lib/server/profile';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const record = await requireProfile(event);
	if (!record.passcode_key) redirect(303, '/expenses');
	if (unlockedKey(event.cookies, record.id, record.owner_sub)) redirect(303, '/expenses');
	return { profile: publicProfile(record), waitFor: throttledFor(record.id) };
};

export const actions: Actions = {
	default: async (event) => {
		const { cookies } = event;
		const record = await requireProfile(event);
		if (!record.passcode_salt || !record.passcode_key) redirect(303, '/expenses');

		const waitFor = throttledFor(record.id);
		if (waitFor) return fail(429, { message: `Too many attempts. Try again in ${waitFor}s.` });

		const passcode = String((await event.request.formData()).get('passcode') ?? '');
		const dataKey = PASSCODE_PATTERN.test(passcode)
			? await unwrapDataKey(passcode, record.passcode_salt, record.passcode_key)
			: null;
		if (!dataKey) {
			const blocked = recordFailure(record.id);
			return fail(403, {
				message: blocked
					? `That passcode is not right. Try again in ${blocked}s.`
					: 'That passcode is not right.'
			});
		}

		clearFailures(record.id);
		startUnlockSession(cookies, record.id, record.owner_sub, dataKey);
		redirect(303, '/expenses');
	}
};
