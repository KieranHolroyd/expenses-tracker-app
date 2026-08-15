import { redirect } from '@sveltejs/kit';
import { safeRedirect, setFlowCookies } from '$lib/server/flow-cookies';
import { authorizationUrl, createPkcePair, randomToken, readOidcConfig } from '$lib/server/oidc';
import type { RequestHandler } from './$types';

/**
 * Starts the authorization-code flow: mint PKCE/state/nonce, stash them in
 * short-lived cookies, and hand the browser to Holroyd ID.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = readOidcConfig();
	// A bare 503 gives someone who clicked "sign in" nothing to act on.
	if (!config) redirect(303, '/auth/unavailable');

	const { verifier, challenge } = await createPkcePair();
	const state = randomToken();
	const nonce = randomToken();
	const target = safeRedirect(url.searchParams.get('redirect'));

	setFlowCookies(cookies, { verifier, state, nonce, redirect: target });

	redirect(303, await authorizationUrl(config, { state, nonce, challenge }));
};
