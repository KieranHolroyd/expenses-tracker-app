import { redirect, type Cookies } from '@sveltejs/kit';
import { queryOne } from './db';
import { unlockedKey } from './lock';
import type { Profile } from '$lib/types';

export const PROFILE_COOKIE = 'ledgerly_profile';

/** The stored row, including the passcode material that must never reach the browser. */
export type ProfileRecord = {
	id: number;
	name: string;
	avatar_color: string;
	passcode_salt: string | null;
	passcode_key: string | null;
};

const COLUMNS = 'id, name, avatar_color, passcode_salt, passcode_key';

export const publicProfile = (record: ProfileRecord): Profile => ({
	id: record.id,
	name: record.name,
	avatar_color: record.avatar_color,
	has_passcode: Boolean(record.passcode_key)
});

export async function findProfile(id: number) {
	return Number.isInteger(id)
		? await queryOne<ProfileRecord>(`SELECT ${COLUMNS} FROM profiles WHERE id = ?`, [id])
		: undefined;
}

/** The profile named by the cookie, or a redirect to the profile picker. */
export async function requireProfile(cookies: Cookies) {
	const record = await findProfile(Number(cookies.get(PROFILE_COOKIE)));
	if (!record) redirect(303, '/profiles');
	return record;
}

/**
 * The profile plus the data key its rows are encrypted with — null when it has no
 * passcode. A protected profile without a live unlock session is sent to the lock
 * screen instead, so no route below this can read ciphertext it cannot open.
 */
export async function requireUnlockedProfile(cookies: Cookies) {
	const record = await requireProfile(cookies);
	if (!record.passcode_key) return { profile: publicProfile(record), key: null };

	const key = unlockedKey(cookies, record.id);
	if (!key) redirect(303, '/unlock');
	return { profile: publicProfile(record), key };
}
