import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

export const UNLOCK_COOKIE = 'ledgerly_unlock';

/**
 * Unlocked data keys live in this process only: the browser holds nothing but an
 * opaque session id, and a restart re-locks every profile. That costs the user a
 * re-entry after each deploy, and buys a guarantee that neither the database nor
 * a captured cookie is enough to read the data.
 */
type Unlocked = { profileId: number; key: Buffer; expiresAt: number };

const sessions = new Map<string, Unlocked>();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Failures are counted per profile, so a shared machine cannot be swept by opening a new tab. */
type Attempts = { failures: number; blockedUntil: number };

const attempts = new Map<number, Attempts>();
const FREE_ATTEMPTS = 5;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 15 * 60 * 1000;

function sweep(now: number) {
	for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
}

export function startUnlockSession(cookies: Cookies, profileId: number, key: Buffer) {
	const now = Date.now();
	sweep(now);
	const id = randomBytes(32).toString('base64url');
	sessions.set(id, { profileId, key, expiresAt: now + SESSION_TTL_MS });
	// A session cookie, with no maxAge: closing the browser locks the profile again.
	cookies.set(UNLOCK_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax' });
}

/** The data key for this profile, or null when the session is missing, stale or for another profile. */
export function unlockedKey(cookies: Cookies, profileId: number) {
	const id = cookies.get(UNLOCK_COOKIE);
	if (!id) return null;
	const session = sessions.get(id);
	if (!session || session.profileId !== profileId) return null;
	if (session.expiresAt <= Date.now()) {
		sessions.delete(id);
		return null;
	}
	session.expiresAt = Date.now() + SESSION_TTL_MS;
	return session.key;
}

export function endUnlockSession(cookies: Cookies) {
	const id = cookies.get(UNLOCK_COOKIE);
	if (id) sessions.delete(id);
	cookies.delete(UNLOCK_COOKIE, { path: '/' });
}

/** Forgets every session for a profile, e.g. after its passcode changes. */
export function forgetProfileSessions(profileId: number) {
	for (const [id, session] of sessions) if (session.profileId === profileId) sessions.delete(id);
}

/** Seconds left before this profile may be tried again, or 0 when it is not throttled. */
export function throttledFor(profileId: number) {
	const record = attempts.get(profileId);
	if (!record) return 0;
	return Math.max(0, Math.ceil((record.blockedUntil - Date.now()) / 1000));
}

export function recordFailure(profileId: number) {
	const record = attempts.get(profileId) ?? { failures: 0, blockedUntil: 0 };
	record.failures += 1;
	if (record.failures > FREE_ATTEMPTS) {
		const delay = Math.min(BASE_DELAY_MS * 2 ** (record.failures - FREE_ATTEMPTS - 1), MAX_DELAY_MS);
		record.blockedUntil = Date.now() + delay;
	}
	attempts.set(profileId, record);
	return throttledFor(profileId);
}

export function clearFailures(profileId: number) {
	attempts.delete(profileId);
}
