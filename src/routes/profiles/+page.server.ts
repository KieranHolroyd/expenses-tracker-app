import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { PERMISSIONS, requirePermission } from '$lib/server/auth';
import { transaction } from '$lib/server/db';
import { endUnlockSession } from '$lib/server/lock';
import {
	claimUnownedProfiles,
	findProfile,
	profilesOwnedBy,
	publicProfile,
	PROFILE_COOKIE
} from '$lib/server/profile';
import type { Actions, PageServerLoad } from './$types';

const MAX_PROFILES = 8;
const COLORS = [
	'#de735c',
	'#477f72',
	'#5577a8',
	'#a4648a',
	'#ba8b3c',
	'#6d64a8',
	'#5d7d45',
	'#a55454'
];

function selectProfile(cookies: Cookies, id: number) {
	cookies.set(PROFILE_COOKIE, String(id), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}

/**
 * The picker is where every session lands before it reaches any data, which
 * makes it the right place to run the one-time adoption of profiles that predate
 * sign-in. After the first time it is a no-op update — see claimUnownedProfiles
 * for why it cannot hand one account's profiles to another.
 */
export const load: PageServerLoad = async (event) => {
	const session = requirePermission(event, PERMISSIONS.read);
	await claimUnownedProfiles(session.user.id);
	return {
		profiles: (await profilesOwnedBy(session.user.id)).map(publicProfile),
		account: { name: session.user.name, email: session.user.email, role: session.role }
	};
};

export const actions: Actions = {
	select: async (event) => {
		const session = requirePermission(event, PERMISSIONS.read);
		const id = Number((await event.request.formData()).get('id'));
		const profile = await findProfile(id, session.user.id);
		if (!profile) return fail(404, { message: 'That profile no longer exists.' });
		// Switching profiles drops any unlock session, so a protected profile is
		// never left open behind someone else's pick.
		endUnlockSession(event.cookies);
		selectProfile(event.cookies, id);
		redirect(303, profile.passcode_key ? '/unlock' : '/expenses');
	},
	create: async (event) => {
		const session = requirePermission(event, PERMISSIONS.write);
		const name = String((await event.request.formData()).get('name') ?? '').trim();
		if (!name || name.length > 24) {
			return fail(400, { message: 'Profile names must be between 1 and 24 characters.' });
		}

		// Counted per account: the limit is about one person's profile list, and a
		// global count would let one account exhaust everybody else's.
		const owned = await profilesOwnedBy(session.user.id);
		if (owned.length >= MAX_PROFILES) {
			return fail(400, { message: `You can create up to ${MAX_PROFILES} profiles.` });
		}

		try {
			const id = await transaction(async (tx) => {
				const inserted = await tx.execute({
					sql: 'INSERT INTO profiles (name, avatar_color, owner_sub) VALUES (?, ?, ?) RETURNING id',
					args: [name, COLORS[owned.length % COLORS.length], session.user.id]
				});
				const profileId = Number(inserted.rows[0].id);
				await tx.execute({
					sql: "INSERT INTO app_settings (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type) VALUES (?, 200000, ?, 28, 'four_week')",
					args: [profileId, new Date().toISOString().slice(0, 10)]
				});
				return profileId;
			});
			endUnlockSession(event.cookies);
			selectProfile(event.cookies, id);
		} catch (error) {
			if (error instanceof Error && error.message.includes('UNIQUE')) {
				return fail(400, { message: 'A profile with that name already exists.' });
			}
			throw error;
		}
		redirect(303, '/expenses');
	}
};
