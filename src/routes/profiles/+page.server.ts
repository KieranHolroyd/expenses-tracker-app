import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { pluck, query, queryOne, transaction } from '$lib/server/db';
import type { Profile } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const PROFILE_COOKIE = 'ledgerly_profile';
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

export const load: PageServerLoad = async () => ({
	profiles: await query<Profile>('SELECT id, name, avatar_color FROM profiles ORDER BY id')
});

export const actions: Actions = {
	select: async ({ request, cookies }) => {
		const id = Number((await request.formData()).get('id'));
		const profile = Number.isInteger(id)
			? await queryOne<Pick<Profile, 'id'>>('SELECT id FROM profiles WHERE id = ?', [id])
			: undefined;
		if (!profile) return fail(404, { message: 'That profile no longer exists.' });
		selectProfile(cookies, id);
		redirect(303, '/expenses');
	},
	create: async ({ request, cookies }) => {
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name || name.length > 24) {
			return fail(400, { message: 'Profile names must be between 1 and 24 characters.' });
		}

		const count = Number((await pluck<number>('SELECT COUNT(*) FROM profiles')) ?? 0);
		if (count >= MAX_PROFILES) {
			return fail(400, { message: `You can create up to ${MAX_PROFILES} profiles.` });
		}

		try {
			const id = await transaction(async (tx) => {
				const inserted = await tx.execute({
					sql: 'INSERT INTO profiles (name, avatar_color) VALUES (?, ?) RETURNING id',
					args: [name, COLORS[count % COLORS.length]]
				});
				const profileId = Number(inserted.rows[0].id);
				await tx.execute({
					sql: "INSERT INTO app_settings (profile_id, payment_amount_pence, payday_anchor_date, cycle_days, cycle_type) VALUES (?, 200000, ?, 28, 'four_week')",
					args: [profileId, new Date().toISOString().slice(0, 10)]
				});
				return profileId;
			});
			selectProfile(cookies, id);
		} catch (error) {
			if (error instanceof Error && error.message.includes('UNIQUE')) {
				return fail(400, { message: 'A profile with that name already exists.' });
			}
			throw error;
		}
		redirect(303, '/expenses');
	}
};
