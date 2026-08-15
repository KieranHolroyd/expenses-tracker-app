import type { Cookies } from '@sveltejs/kit';

/**
 * Short-lived cookies that carry one sign-in attempt across the round trip to
 * the provider: the PKCE verifier, the CSRF state, the replay nonce, and where
 * to land afterwards.
 */
export const FLOW_COOKIES = {
	verifier: 'ledgerly_oidc_verifier',
	state: 'ledgerly_oidc_state',
	nonce: 'ledgerly_oidc_nonce',
	redirect: 'ledgerly_oidc_redirect'
} as const;

/** Ten minutes is plenty to sign in and well short of leaving it lying around. */
const FLOW_TTL_SECONDS = 600;

export function isSecureOrigin() {
	// Dev runs over plain http on localhost, where a Secure cookie is dropped.
	return (process.env.ORIGIN ?? '').startsWith('https://');
}

export function setFlowCookies(
	cookies: Cookies,
	values: { verifier: string; state: string; nonce: string; redirect: string }
) {
	const options = {
		path: '/auth',
		httpOnly: true,
		// `lax` and not `strict`: the return from the provider is a top-level
		// cross-site GET, and a strict cookie would not be sent with it — the
		// callback would then reject every legitimate sign-in.
		sameSite: 'lax' as const,
		secure: isSecureOrigin(),
		maxAge: FLOW_TTL_SECONDS
	};

	cookies.set(FLOW_COOKIES.verifier, values.verifier, options);
	cookies.set(FLOW_COOKIES.state, values.state, options);
	cookies.set(FLOW_COOKIES.nonce, values.nonce, options);
	cookies.set(FLOW_COOKIES.redirect, values.redirect, options);
}

export function readFlowCookies(cookies: Cookies) {
	return {
		verifier: cookies.get(FLOW_COOKIES.verifier),
		state: cookies.get(FLOW_COOKIES.state),
		nonce: cookies.get(FLOW_COOKIES.nonce),
		redirect: cookies.get(FLOW_COOKIES.redirect)
	};
}

export function clearFlowCookies(cookies: Cookies) {
	for (const name of Object.values(FLOW_COOKIES)) cookies.delete(name, { path: '/auth' });
}

/**
 * Only same-site paths are acceptable as a post-login destination. An absolute
 * URL here would turn the sign-in flow into an open redirect, which is a
 * ready-made phishing primitive against exactly the people who trust this
 * domain. Protocol-relative `//evil.com` counts as absolute.
 */
export function safeRedirect(target: string | null | undefined) {
	if (!target) return '/profiles';
	if (!target.startsWith('/') || target.startsWith('//')) return '/profiles';
	return target;
}
