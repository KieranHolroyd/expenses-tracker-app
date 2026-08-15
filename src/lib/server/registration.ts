import { execute, queryOne } from './db';
import {
	appOrigin,
	issuerUrl,
	redirectUriFor,
	setRegisteredClient,
	SLUG,
	type StoredClient
} from './oidc';
import { PERMISSIONS } from './auth';

/**
 * Self-registration against Holroyd ID.
 *
 * Ledgerly announces itself on boot and receives its own OAuth client, so
 * deploying it needs no auth configuration at all — not a client id, not a
 * secret, not a shared token. What authorises the registration is where Ledgerly
 * lives: the provider accepts a tokenless registration when every redirect URI
 * is on a trusted domain, and hands back a *public* client whose id is the slug.
 *
 * That is why nothing is persisted on this path. A public client has no secret
 * to keep and a predictable id, so re-registering on every boot is both the
 * cheapest thing to do and what keeps redirect URIs current.
 *
 * Registering does not grant anyone access: a new application is closed until an
 * admin opens it. That is what makes the tokenless path safe — it hands out
 * identity for the app, not access for a person.
 */

const RETRY_MS = 60_000;

/**
 * Reports why sign-in is unavailable, once per distinct reason.
 *
 * Registration retries every minute, and repeating the same paragraph forever
 * turns a real problem into scrollback. Repeating it when the *reason* changes
 * is the part worth hearing.
 */
let lastReported: string | null = null;

function report(message: string) {
	if (lastReported === message) return;
	lastReported = message;
	console.error(`[registration] ${message}`);
}

function reportSuccess(message: string) {
	lastReported = null;
	console.log(`[registration] ${message}`);
}

interface Registration {
	slug: string;
	name: string;
	description: string;
	trusted: boolean;
	redirect_uris: string[];
	post_logout_redirect_uris: string[];
	permissions: Array<{ key: string; description?: string }>;
	roles: Array<{ key: string; description?: string; permissions?: string[] }>;
}

function manifest(origin: string): Registration {
	return {
		slug: SLUG,
		name: 'Ledgerly',
		description: 'Recurring expense tracker — subscriptions, paydays and what they add up to.',
		// First-party: there is no meaningful consent question when the same person
		// owns both sides.
		trusted: true,
		redirect_uris: [redirectUriFor(origin)],
		post_logout_redirect_uris: [new URL('/', origin).toString()],
		// Declared *and* enforced. A role the application does not enforce is worse
		// than no role at all: an admin grants "viewer" expecting read-only access
		// and gets an editor, with nothing in the UI to suggest otherwise. Both
		// permissions below are checked — see requirePermission in auth.ts.
		//
		// Note also that a grant may only name a role the application declared, so
		// an application with no roles cannot be granted to at all.
		permissions: [
			{
				key: PERMISSIONS.read,
				description: 'See your own profiles, their expenses, insights and forecasts'
			},
			{
				key: PERMISSIONS.write,
				description: 'Add, edit, import and delete expenses, and change the payment schedule'
			}
		],
		roles: [
			{
				key: 'viewer',
				description: 'Read your profiles and everything derived from them.',
				permissions: [PERMISSIONS.read]
			},
			{
				key: 'editor',
				description: 'Read and change your profiles, expenses and payment schedule.',
				permissions: [PERMISSIONS.read, PERMISSIONS.write]
			}
		]
	};
}

/**
 * A client with a secret. Only confidential clients are ever persisted — a
 * public one has nothing worth a row — so the storage helpers below insist on
 * the secret being present rather than accepting the wider `StoredClient`.
 */
type ConfidentialClient = StoredClient & { clientSecret: string };

async function loadStored(issuer: string): Promise<ConfidentialClient | null> {
	const row = await queryOne<{ client_id: string; client_secret: string }>(
		'SELECT client_id, client_secret FROM oidc_client WHERE issuer = ? LIMIT 1',
		[issuer]
	);
	return row ? { issuer, clientId: row.client_id, clientSecret: row.client_secret } : null;
}

async function store(client: ConfidentialClient) {
	await execute(
		`INSERT INTO oidc_client (issuer, client_id, client_secret) VALUES (?, ?, ?)
		ON CONFLICT (issuer) DO UPDATE
			SET client_id = excluded.client_id,
				client_secret = excluded.client_secret,
				updated_at = CURRENT_TIMESTAMP`,
		[client.issuer, client.clientId, client.clientSecret]
	);
}

const registerUrl = (issuer: string) => `${issuer}/api/applications/register`;

async function messageOf(response: Response) {
	try {
		const body = (await response.json()) as { message?: string };
		return body.message ?? '';
	} catch {
		return '';
	}
}

/** Refreshes redirect URIs and metadata. Authenticates as the app itself. */
async function update(client: ConfidentialClient, origin: string) {
	const basic = Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64');

	const response = await fetch(registerUrl(client.issuer), {
		method: 'PUT',
		headers: { 'content-type': 'application/json', authorization: `Basic ${basic}` },
		body: JSON.stringify(manifest(origin)),
		signal: AbortSignal.timeout(10_000)
	});

	if (response.ok) return;

	if (response.status === 401) {
		// The provider no longer recognises these credentials — most likely the
		// application was deleted and recreated there. Keep using them anyway
		// rather than discarding the only copy we hold; sign-in will fail loudly
		// and an admin can reset the registration deliberately.
		console.error(
			'[registration] stored credentials were rejected. If the application was ' +
				"removed from Holroyd ID, clear Ledgerly's oidc_client row so it can register afresh."
		);
		return;
	}

	// A failed refresh is not fatal: the existing client still works, only the
	// redirect URIs may be stale.
	console.error(`[registration] could not refresh registration: HTTP ${response.status}`);
}

/**
 * Registration with no credential at all — the zero-configuration path.
 *
 * The provider allows this when every redirect URI is on a trusted domain, and
 * returns a public client: no secret, `client_id` equal to the slug, PKCE
 * enforced. Nothing comes back that needs storing, so this runs on every boot
 * and doubles as the refresh that keeps redirect URIs current.
 */
async function registerPublic(issuer: string, origin: string) {
	const response = await fetch(registerUrl(issuer), {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(manifest(origin)),
		signal: AbortSignal.timeout(10_000)
	});

	if (response.status === 403) {
		// Two ways to land here, and they need different fixes, so say both. The
		// provider's own message distinguishes them; include it rather than guess.
		throw new Error(
			`Tokenless registration was refused: ${await messageOf(response)} ` +
				`Either ORIGIN (${origin}) is not on a domain the auth service trusts ` +
				`(see TRUSTED_DOMAINS there), or "${SLUG}" is already registered as a ` +
				'confidential client — which only its own credentials may update. Set ' +
				'AUTH_CLIENT_ID and AUTH_CLIENT_SECRET, or remove the stale application ' +
				'in the admin UI.'
		);
	}

	if (!response.ok) {
		throw new Error(`Registration failed: HTTP ${response.status}. ${await messageOf(response)}`);
	}

	const body = (await response.json()) as { client_id?: string; client_secret?: string };
	if (!body.client_id) throw new Error('Registration response carried no client_id');

	if (body.client_secret) {
		// A secret means the provider made a confidential client after all — a
		// configuration we did not ask for, and the secret is shown exactly once.
		// Persist it rather than dropping the only copy.
		const client: ConfidentialClient = {
			issuer,
			clientId: body.client_id,
			clientSecret: body.client_secret
		};
		await store(client);
		setRegisteredClient(client);
	} else {
		setRegisteredClient({ issuer, clientId: body.client_id });
	}

	reportSuccess(
		`registered with Holroyd ID as "${SLUG}" (${response.status === 201 ? 'created' : 'refreshed'}). ` +
			'It is closed to everyone until an administrator grants access, so grant ' +
			'yourself the application there before signing in.'
	);
}

/** First-time registration using the shared token. */
async function create(issuer: string, origin: string, token: string) {
	const response = await fetch(registerUrl(issuer), {
		method: 'PUT',
		headers: { 'content-type': 'application/json', 'x-registration-token': token },
		body: JSON.stringify(manifest(origin)),
		signal: AbortSignal.timeout(10_000)
	});

	if (response.status === 403) {
		// Already registered under this slug, but we do not hold its credentials —
		// updates require the app's own, and the shared token deliberately cannot
		// substitute. Recoverable only by an admin.
		throw new Error(
			`"${SLUG}" is already registered with Holroyd ID but Ledgerly has no stored ` +
				'credentials for it. Delete the application there and let Ledgerly register ' +
				'again, or set AUTH_CLIENT_ID and AUTH_CLIENT_SECRET explicitly.'
		);
	}

	if (response.status === 404) {
		throw new Error(
			`${issuer} has no APP_REGISTRATION_TOKEN set, so self-registration is ` +
				'disabled there and nobody can sign in. Set APP_REGISTRATION_TOKEN on ' +
				"the auth service to the same value as Ledgerly's AUTH_REGISTRATION_TOKEN, " +
				'or set AUTH_CLIENT_ID and AUTH_CLIENT_SECRET on Ledgerly instead.'
		);
	}

	if (response.status === 401) {
		throw new Error(
			"The registration token was rejected. Ledgerly's AUTH_REGISTRATION_TOKEN and " +
				"the auth service's APP_REGISTRATION_TOKEN must be the same value."
		);
	}

	if (!response.ok) throw new Error(`Registration failed: HTTP ${response.status}`);

	const body = (await response.json()) as { client_id?: string; client_secret?: string };

	if (!body.client_id || !body.client_secret) {
		// An update response has no secret. Reaching here means we thought this was
		// a first registration but the provider disagreed, and we have nothing to
		// store — better to fail than to record half a credential.
		throw new Error('Registration response carried no credentials');
	}

	const client: ConfidentialClient = {
		issuer,
		clientId: body.client_id,
		clientSecret: body.client_secret
	};

	await store(client);
	setRegisteredClient(client);

	reportSuccess(
		`registered with Holroyd ID as "${SLUG}". ` +
			'It is closed to everyone until an administrator grants access, so grant ' +
			'yourself the application there before signing in.'
	);
}

/**
 * Resolves Ledgerly's OIDC client, registering if needed. Safe to call repeatedly.
 *
 * Returns true once credentials are in hand, so the caller knows whether to keep
 * retrying.
 */
export async function ensureRegistered(): Promise<boolean> {
	const issuer = issuerUrl();
	const origin = appOrigin();

	if (!origin) {
		// ORIGIN is the only thing sign-in still needs: the issuer is derived from
		// it and the redirect URI is built from it.
		report('sign-in is unavailable: ORIGIN is not set.');
		return false;
	}
	if (!issuer) {
		report('sign-in is unavailable: AUTH_ISSUER_URL is set to an unusable value.');
		return false;
	}

	// Explicit credentials mean someone has chosen to manage this by hand.
	if (process.env.AUTH_CLIENT_ID && process.env.AUTH_CLIENT_SECRET) return true;

	const stored = await loadStored(issuer);
	if (stored) {
		setRegisteredClient(stored);
		// Best effort: a stale redirect URI is worth fixing, but not at the cost of
		// failing startup when the provider is briefly unreachable.
		await update(stored, origin).catch((error: unknown) => {
			console.error('[registration] refresh failed:', error);
		});
		return true;
	}

	// A token is no longer required, only honoured: setting one is how you ask
	// for a confidential client instead of a public one.
	const token = process.env.AUTH_REGISTRATION_TOKEN;
	if (token) {
		await create(issuer, origin, token);
		return true;
	}

	await registerPublic(issuer, origin);
	return true;
}

/**
 * Whether another attempt could plausibly differ. With ORIGIN set there is
 * always a registration to attempt — tokenless if nothing else — so the only
 * hopeless case is having no origin at all, where retrying would print the same
 * line every minute forever.
 */
function canRetry() {
	return !!(issuerUrl() && appOrigin());
}

/**
 * Kicks off registration at boot and keeps retrying until it succeeds.
 *
 * Retries because Ledgerly and the auth service are usually brought up together:
 * on a host reboot Ledgerly can easily win the race, and a one-shot attempt would
 * leave sign-in dead until someone restarted the container.
 */
export function startRegistration() {
	let timer: NodeJS.Timeout | null = null;

	const attempt = async () => {
		try {
			return await ensureRegistered();
		} catch (error) {
			report(error instanceof Error ? error.message : String(error));
			return false;
		}
	};

	void attempt().then((done) => {
		// Only schedule retries if the first attempt failed *and* another try could
		// plausibly succeed. With no origin configured, retrying forever would just
		// print the same error every minute.
		if (done || !canRetry()) return;

		timer = setInterval(() => {
			void attempt().then((ok) => {
				if (ok && timer) {
					clearInterval(timer);
					timer = null;
				}
			});
		}, RETRY_MS);
	});
}
