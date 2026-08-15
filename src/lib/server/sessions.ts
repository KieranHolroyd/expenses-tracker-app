import { execute, queryOne } from './db';
import type { Claims } from './oidc';

export const SESSION_COOKIE = 'ledgerly_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How long a session may go without re-checking the grant behind it. */
export const PERMISSION_TTL_MS = 5 * 60 * 1000;

export interface StoredSession {
	/** Effective permissions for Ledgerly. Empty means signed in but not granted. */
	permissions: string[];
	/** Granted role, for display only. */
	role?: string;
	user: {
		/** The Holroyd ID subject. This is what `profiles.owner_sub` holds. */
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
	session: {
		expiresAt: string;
	};
}

interface SessionRow {
	token: string;
	subject: string;
	email: string | null;
	name: string | null;
	picture: string | null;
	id_token: string | null;
	refresh_token: string | null;
	permissions: string;
	role: string | null;
	permissions_checked_at: number;
	expires_at: number;
}

/**
 * Sessions live in the database rather than in a signed cookie.
 *
 * The cookie carries an opaque token and nothing else, so a session can be
 * revoked server-side and no identity claim is ever parked in the browser. It
 * also means no signing key for Ledgerly to hold and rotate.
 *
 * Note what is *not* stored here: an unlocked profile's data key. Those stay in
 * lock.ts, in memory only — a session row must never be enough to read someone's
 * encrypted expenses, or the passcode would be decoration.
 */
export async function createSession(
	claims: Claims,
	idToken?: string,
	refreshToken?: string
): Promise<{ token: string; expiresAt: Date }> {
	const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

	await execute(
		`INSERT INTO sessions (
			token, subject, email, name, picture, id_token, refresh_token,
			permissions, role, permissions_checked_at, expires_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			token,
			claims.sub,
			claims.email ?? null,
			claims.name ?? claims.preferred_username ?? null,
			claims.picture ?? null,
			idToken ?? null,
			refreshToken ?? null,
			JSON.stringify(claims.permissions),
			claims.role ?? null,
			Date.now(),
			expiresAt.getTime()
		]
	);

	return { token, expiresAt };
}

/** Tolerates a malformed column rather than failing the request closed-but-noisy. */
function parsePermissions(value: string): string[] {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
	} catch {
		return [];
	}
}

export async function readSession(token: string): Promise<StoredSession | null> {
	const row = await queryOne<SessionRow>(
		'SELECT * FROM sessions WHERE token = ? AND expires_at > ? LIMIT 1',
		[token, Date.now()]
	);
	if (!row) return null;

	return {
		permissions: parsePermissions(row.permissions),
		role: row.role ?? undefined,
		user: {
			id: row.subject,
			// Fall back to the subject so the UI always has something to print; an
			// account with no profile scope granted still gets a usable session.
			name: row.name ?? row.email ?? row.subject,
			email: row.email ?? '',
			image: row.picture
		},
		session: { expiresAt: new Date(row.expires_at).toISOString() }
	};
}

export async function readIdToken(token: string): Promise<string | null> {
	const row = await queryOne<{ id_token: string | null }>(
		'SELECT id_token FROM sessions WHERE token = ? LIMIT 1',
		[token]
	);
	return row?.id_token ?? null;
}

export async function deleteSession(token: string): Promise<void> {
	await execute('DELETE FROM sessions WHERE token = ?', [token]);
}

/** Called opportunistically after sign-in; expired rows are already unreadable. */
export async function pruneExpiredSessions(): Promise<void> {
	await execute('DELETE FROM sessions WHERE expires_at < ?', [Date.now() - 24 * 60 * 60 * 1000]);
}

/**
 * Re-reads the grant behind a session when it has gone stale.
 *
 * Without this, revoking someone's access would not reach them until their
 * session expired days later — the provider's own guidance is that revocation
 * lands within an access token's lifetime, and a long-lived local session is
 * exactly the thing that breaks that promise.
 *
 * A refresh that fails is treated as revocation and ends the session, because
 * the provider drops the refresh token when a grant is withdrawn.
 */
export async function refreshSessionIfStale(token: string): Promise<StoredSession | null> {
	const row = await queryOne<{ refresh_token: string | null; permissions_checked_at: number }>(
		'SELECT refresh_token, permissions_checked_at FROM sessions WHERE token = ? AND expires_at > ? LIMIT 1',
		[token, Date.now()]
	);
	if (!row) return null;

	if (Date.now() - row.permissions_checked_at < PERMISSION_TTL_MS) return readSession(token);

	// No refresh token — an older session, or a provider that issued none. Stamp
	// it so we do not retry on every request, and carry on with what we have.
	if (!row.refresh_token) {
		await execute('UPDATE sessions SET permissions_checked_at = ? WHERE token = ?', [
			Date.now(),
			token
		]);
		return readSession(token);
	}

	const { readOidcConfig, refreshClaims } = await import('./oidc');
	const config = readOidcConfig();
	if (!config) return readSession(token);

	try {
		const { claims, refreshToken } = await refreshClaims(config, row.refresh_token);
		await execute(
			`UPDATE sessions SET permissions = ?, role = ?, refresh_token = ?, permissions_checked_at = ?
			WHERE token = ?`,
			[JSON.stringify(claims.permissions), claims.role ?? null, refreshToken, Date.now(), token]
		);
		return readSession(token);
	} catch (error) {
		console.error('[auth] grant re-check failed, ending session:', error);
		await deleteSession(token);
		return null;
	}
}
