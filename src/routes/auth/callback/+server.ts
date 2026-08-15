import { error, redirect } from '@sveltejs/kit';
import {
	clearFlowCookies,
	isSecureOrigin,
	readFlowCookies,
	safeRedirect
} from '$lib/server/flow-cookies';
import { exchangeCode, readOidcConfig, verifyIdToken } from '$lib/server/oidc';
import {
	createSession,
	pruneExpiredSessions,
	SESSION_COOKIE,
	SESSION_TTL_MS
} from '$lib/server/sessions';
import type { RequestHandler } from './$types';

/** Completes the flow: validate state, exchange the code, mint a local session. */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = readOidcConfig();
	if (!config) error(503, 'Sign-in is not configured');

	const flow = readFlowCookies(cookies);
	clearFlowCookies(cookies);

	// The provider reports failures here rather than at the token endpoint.
	const providerError = url.searchParams.get('error');
	if (providerError) {
		// Surface the code but not `error_description`, which is attacker-influenced
		// text that would be rendered straight back to the user.
		error(403, `Sign-in was refused (${providerError})`);
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state) error(400, 'Malformed sign-in response');
	if (!flow.verifier || !flow.state || !flow.nonce) {
		error(400, 'Sign-in attempt expired — please try again');
	}
	// Constant-time is unnecessary: both values are ours and single-use, and the
	// attempt is discarded either way.
	if (state !== flow.state) error(400, 'Sign-in state mismatch');

	let session: { token: string; expiresAt: Date };
	try {
		const tokens = await exchangeCode(config, { code, verifier: flow.verifier });
		const claims = await verifyIdToken(config, tokens.id_token, flow.nonce);
		session = await createSession(claims, tokens.id_token, tokens.refresh_token);
	} catch (cause) {
		console.error('[auth] sign-in failed:', cause);
		error(502, 'Could not complete sign-in');
	}

	cookies.set(SESSION_COOKIE, session.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureOrigin(),
		expires: session.expiresAt,
		maxAge: Math.floor(SESSION_TTL_MS / 1000)
	});

	// Cheap housekeeping on a rare path, rather than a scheduled job.
	void pruneExpiredSessions().catch(() => {});

	redirect(303, safeRedirect(flow.redirect));
};
