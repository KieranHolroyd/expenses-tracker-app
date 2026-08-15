import { redirect } from '@sveltejs/kit';
import { execute, query, queryOne } from './db';
import { PERMISSIONS, requirePermission, type AuthContext } from './auth';
import { unlockedKey } from './lock';
import type { Profile } from '$lib/types';

export const PROFILE_COOKIE = 'ledgerly_profile';

/**
 * Profiles and identity, in one place.
 *
 * Three separate things have to line up before a page can read an expense, and
 * this module is where all three meet, so that no route has to remember them
 * individually:
 *
 * 1. **Who you are** — a Holroyd ID session, from `hooks.server.ts`.
 * 2. **What you may do** — a permission from the grant behind that session.
 * 3. **Whether the rows can be opened** — the data key from an unlock session,
 *    for a passcode-protected profile.
 *
 * Ownership is what ties (1) to the data: every profile belongs to the account
 * that created it, so every lookup here is scoped by `owner_sub` rather than
 * checked afterwards. A profile id from a stale or forged cookie simply does not
 * resolve for the wrong account, which is the failure mode you want — there is
 * no path where the wrong person's rows are fetched and then rejected.
 */

/** The stored row, including the passcode material that must never reach the browser. */
export type ProfileRecord = {
	id: number;
	name: string;
	avatar_color: string;
	/** The Holroyd ID subject this profile belongs to. */
	owner_sub: string;
	passcode_salt: string | null;
	passcode_key: string | null;
};

const COLUMNS = 'id, name, avatar_color, owner_sub, passcode_salt, passcode_key';

export const publicProfile = (record: ProfileRecord): Profile => ({
	id: record.id,
	name: record.name,
	avatar_color: record.avatar_color,
	has_passcode: Boolean(record.passcode_key)
});

export async function findProfile(id: number, ownerSub: string) {
	return Number.isInteger(id)
		? await queryOne<ProfileRecord>(
				`SELECT ${COLUMNS} FROM profiles WHERE id = ? AND owner_sub = ?`,
				[id, ownerSub]
			)
		: undefined;
}

export async function profilesOwnedBy(ownerSub: string) {
	return query<ProfileRecord>(`SELECT ${COLUMNS} FROM profiles WHERE owner_sub = ? ORDER BY id`, [
		ownerSub
	]);
}

/**
 * Adopts the profiles that predate sign-in.
 *
 * A database created before Ledgerly had accounts has profiles with no owner,
 * and without this they would be invisible to everyone — the data would still be
 * there, and nobody could reach it.
 *
 * The `NOT EXISTS` clause is the whole safety argument, and it is why this is a
 * single statement rather than a read followed by a write: unowned profiles are
 * adopted only while *nothing* is owned yet. So the first person to sign in
 * after the upgrade takes the pre-existing data, and every account after that
 * finds the condition false and starts empty. A second person signing in cannot
 * help themselves to the first person's profiles, and two people racing at the
 * same moment cannot both win.
 */
export async function claimUnownedProfiles(ownerSub: string) {
	await execute(
		`UPDATE profiles SET owner_sub = ?
		WHERE owner_sub IS NULL
			AND NOT EXISTS (SELECT 1 FROM profiles WHERE owner_sub IS NOT NULL)`,
		[ownerSub]
	);
}

/**
 * The signed-in account's profile named by the cookie, or a redirect to the
 * picker. Signing in is required first, and so is `permission` — writes pass
 * {@link PERMISSIONS.write} so that a viewer grant really is read-only.
 */
export async function requireProfile(
	context: AuthContext,
	permission: string = PERMISSIONS.read
): Promise<ProfileRecord> {
	const session = requirePermission(context, permission);
	const record = await findProfile(Number(context.cookies.get(PROFILE_COOKIE)), session.user.id);
	// No profile, someone else's profile, or one deleted since: all the same
	// answer, and all resolved at the picker rather than reported here.
	if (!record) redirect(303, '/profiles');
	return record;
}

/**
 * The profile plus the data key its rows are encrypted with — null when it has
 * no passcode. A protected profile without a live unlock session is sent to the
 * lock screen instead, so no route below this can read ciphertext it cannot open.
 */
export async function requireUnlockedProfile(
	context: AuthContext,
	permission: string = PERMISSIONS.read
) {
	const record = await requireProfile(context, permission);
	if (!record.passcode_key) return { profile: publicProfile(record), key: null };

	const key = unlockedKey(context.cookies, record.id, record.owner_sub);
	if (!key) redirect(303, '/unlock');
	return { profile: publicProfile(record), key };
}
