import { error, redirect, type Cookies } from '@sveltejs/kit';
import { readOidcConfig } from './oidc';
import { refreshSessionIfStale, SESSION_COOKIE, type StoredSession } from './sessions';

/**
 * The whole auth surface of this app. Nothing outside this module and its
 * helpers (`oidc.ts`, `sessions.ts`, `flow-cookies.ts`) knows how identity works.
 *
 * Identity comes from Holroyd ID at auth.holroydnet.uk via the OIDC
 * authorization-code flow; Ledgerly mints its own session from the claims.
 *
 * Identity is not the same thing as the passcode on a profile, and neither
 * replaces the other. Signing in decides *whose* profiles you see; a passcode
 * decides whether the rows inside one can be decrypted at all. Holroyd ID never
 * sees the passcode and cannot recover it — see lock.ts and crypto.ts.
 */
export type Session = StoredSession;

export { SESSION_COOKIE } from './sessions';

/**
 * Permissions Ledgerly declares in its manifest and enforces here. Kept as
 * constants so a typo is a compile error rather than a silently permissive check.
 */
export const PERMISSIONS = {
	read: 'expenses:read',
	write: 'expenses:write'
} as const;

export function can(session: Session | null, permission: string) {
	return !!session?.permissions.includes(permission);
}

/**
 * True when running in production without a usable OIDC client.
 *
 * In that state nobody gets a session: the dev bypass must never be reachable in
 * production, since that is precisely how a page showing someone's finances ends
 * up on the open internet.
 *
 * It does not log. Registration runs in the background, so the first request
 * routinely arrives before credentials exist; registration.ts knows why sign-in
 * is unavailable and reports it there.
 */
function isMisconfigured() {
	return process.env.NODE_ENV === 'production';
}

const devSession: Session = {
	user: {
		id: 'dev',
		name: 'Kieran Holroyd',
		email: 'kieran@nitrexdesign.co.uk'
	},
	session: { expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
	// Development stands in for a fully granted operator; production gets these
	// from the provider and nowhere else.
	permissions: [PERMISSIONS.read, PERMISSIONS.write],
	role: 'editor'
};

export async function getSession(cookies: Cookies): Promise<Session | null> {
	if (!readOidcConfig()) {
		if (isMisconfigured()) return null;
		// Development without a registered client: a stub session keeps the app
		// workable, and its `dev` subject owns the local profiles. Unreachable in
		// production — see above.
		return devSession;
	}

	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;

	try {
		return await refreshSessionIfStale(token);
	} catch (cause) {
		// A database blip must read as "not signed in", never as "signed in".
		console.error('[auth] session lookup failed:', cause);
		return null;
	}
}

/**
 * Where to send someone who needs to sign in.
 *
 * Always Ledgerly's own `/auth/login`, never the provider directly — the login
 * route is what generates the PKCE verifier, state and nonce for that attempt.
 */
export function signInUrl(returnTo = '/profiles') {
	if (!readOidcConfig()) {
		// No client configured. Send people somewhere that says so, rather than
		// bouncing them to a page with no explanation — that reads as the app being
		// broken. Returning `returnTo` would loop the route into itself.
		return isMisconfigured() ? '/auth/unavailable' : returnTo;
	}
	return `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
}

/** True when a real OIDC client is configured, i.e. signing in is possible. */
export function authAvailable() {
	return readOidcConfig() !== null;
}

/**
 * What every guard in this app needs. A SvelteKit `RequestEvent` satisfies it,
 * so load functions and actions pass themselves; `url` is optional only so that
 * a caller with nothing but cookies and locals still works.
 */
export type AuthContext = { cookies: Cookies; locals: App.Locals; url?: URL };

/**
 * The session behind this request, or a redirect to sign in.
 *
 * Where to come back to is taken from the request itself. That is right for a
 * GET; for a form action the submission is lost either way — a redirect through
 * the provider returns as a GET — so landing back on the page it was submitted
 * from is the best available answer.
 */
export function requireSession(context: AuthContext): Session {
	const { session } = context.locals;
	if (!session) redirect(303, signInUrl(context.url?.pathname));
	return session;
}

/**
 * The session, once it is known to carry `permission`.
 *
 * A 403 rather than a redirect: they signed in fine, so bouncing them back
 * through the provider would loop and still land here. The message names the
 * thing an admin actually has to do.
 */
export function requirePermission(context: AuthContext, permission: string) {
	const session = requireSession(context);
	if (!can(session, permission)) {
		error(
			403,
			`Your Holroyd ID account does not have access to Ledgerly${
				permission === PERMISSIONS.write ? ' with permission to make changes' : ''
			}. Ask an administrator to grant it.`
		);
	}
	return session;
}
