import { redirect } from '@sveltejs/kit';
import { isSecureOrigin } from '$lib/server/flow-cookies';
import { endUnlockSession } from '$lib/server/lock';
import { endSessionUrl, readOidcConfig } from '$lib/server/oidc';
import { PROFILE_COOKIE } from '$lib/server/profile';
import { deleteSession, readIdToken, SESSION_COOKIE } from '$lib/server/sessions';
import type { RequestHandler } from './$types';

/**
 * POST only. A GET logout can be triggered by any `<img>` on any page, which
 * makes signing people out a drive-by. The header's sign-out control is a form.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);

	let idToken: string | null = null;
	if (token) {
		try {
			idToken = await readIdToken(token);
			await deleteSession(token);
		} catch (error) {
			// Clearing the cookie still signs them out of Ledgerly; a stranded row
			// expires on its own. Failing here would leave them apparently signed in.
			console.error('[auth] failed to delete session:', error);
		}
	}

	// Signing out has to give up the decryption keys too. The unlock session lives
	// in process memory, so leaving it behind would mean the next person to sign in
	// at this browser could re-select the profile and read it without the passcode.
	endUnlockSession(cookies);
	cookies.delete(PROFILE_COOKIE, { path: '/' });

	cookies.delete(SESSION_COOKIE, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureOrigin()
	});

	// End the provider session too, so "sign out" does not leave you able to sign
	// straight back in without a prompt.
	const config = readOidcConfig();
	if (config) {
		const url = await endSessionUrl(config, idToken ?? undefined).catch(() => null);
		if (url) redirect(303, url);
	}

	redirect(303, '/');
};
