import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * OIDC authorization-code client for Holroyd ID (auth.holroydnet.uk).
 *
 * The provider is a full OIDC server, not a shared-cookie session service: its
 * `/api/auth/get-session` describes the provider's *own* session, not ours. So
 * Ledgerly runs the authorization-code flow with PKCE and mints its own session.
 */

export interface OidcConfig {
	issuer: string;
	clientId: string;
	/**
	 * Absent for a public client, which is what self-registration produces. PKCE
	 * is what protects the code in that case; see registration.ts.
	 */
	clientSecret?: string;
	redirectUri: string;
}

interface Discovery {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	jwks_uri: string;
	userinfo_endpoint?: string;
	end_session_endpoint?: string;
}

export interface Claims {
	sub: string;
	email?: string;
	email_verified?: boolean;
	name?: string;
	preferred_username?: string;
	picture?: string;
	/** Effective permissions for this application. Empty means no access. */
	permissions: string[];
	/** The granted role, for display. Authorisation reads permissions, not this. */
	role?: string;
}

/**
 * Scopes Ledgerly asks for.
 *
 * `permissions` carries the roles and effective permissions this app enforces.
 * `offline_access` buys a refresh token, which is what keeps a revoked grant
 * from lingering: Ledgerly's own session lasts days, so without re-checking,
 * taking someone's access away would not reach them until it expired.
 *
 * No `groups`: nothing here is decided by group membership, and a page that
 * shows somebody's finances has no business also learning who they live with.
 */
export const SCOPES = 'openid profile email permissions offline_access';

/** The application slug Ledgerly is registered under, and the key its claims sit at. */
export const SLUG = 'ledgerly';

const PERMISSIONS_CLAIM = 'https://holroydnet.uk/permissions';
const ROLES_CLAIM = 'https://holroydnet.uk/roles';

export interface StoredClient {
	issuer: string;
	clientId: string;
	/** Absent for a public client — there is no secret to hold. */
	clientSecret?: string;
}

/**
 * Credentials obtained by self-registration, cached in memory so resolving the
 * config stays synchronous — otherwise every load function and endpoint that
 * asks "can we sign in?" would owe a database round trip.
 *
 * Populated at boot by registration.ts, which is the only writer.
 */
let registeredClient: StoredClient | null = null;

export function setRegisteredClient(client: StoredClient | null): void {
	registeredClient = client;
}

const DEFAULT_ISSUER = 'https://auth.holroydnet.uk';

/**
 * Where Holroyd ID lives.
 *
 * Derived from ORIGIN rather than configured, because on this network the two
 * always sit on the same parent domain: `ledgerly.holroydnet.uk` implies
 * `auth.holroydnet.uk`. That is the last piece of per-app OIDC configuration,
 * and removing it is what lets a deploy consist of ORIGIN and nothing else.
 *
 * AUTH_ISSUER_URL still overrides, for a provider somewhere else entirely.
 */
export function issuerUrl(): string | undefined {
	const configured = process.env.AUTH_ISSUER_URL?.replace(/\/$/, '');
	if (configured) return configured;

	const origin = appOrigin();
	if (!origin) return undefined;
	return derivedIssuer(origin) ?? DEFAULT_ISSUER;
}

/**
 * Swaps the leftmost host label for `auth`, so `ledgerly.holroydnet.uk` becomes
 * `auth.holroydnet.uk`.
 *
 * Returns undefined for anything with fewer than three labels — an apex domain
 * or `localhost` has no subdomain to replace, and blindly prefixing would aim
 * at `auth.uk`. Those fall back to the default above, which is also what makes
 * `pnpm dev` against localhost work with no configuration.
 */
function derivedIssuer(origin: string): string | undefined {
	let host: string;
	try {
		host = new URL(origin).hostname;
	} catch {
		return undefined;
	}

	const labels = host.split('.');
	if (labels.length < 3) return undefined;
	return `https://auth.${labels.slice(1).join('.')}`;
}

export function appOrigin(): string | undefined {
	return process.env.ORIGIN;
}

export function redirectUriFor(origin: string): string {
	return new URL('/auth/callback', origin).toString();
}

export function readOidcConfig(): OidcConfig | null {
	const issuer = issuerUrl();
	const origin = appOrigin();
	if (!issuer || !origin) return null;

	// Explicit credentials win: they are the escape hatch when self-registration
	// is unavailable, or when someone wants to pin a hand-made client.
	let clientId = process.env.AUTH_CLIENT_ID;
	let clientSecret = process.env.AUTH_CLIENT_SECRET;

	if (!clientId) {
		// No registration yet means the client does not exist at the provider, so
		// there is nothing to sign in against — even though a public client's id is
		// predictable, using it before registering would just fail at /authorize.
		if (registeredClient?.issuer !== issuer) return null;
		clientId = registeredClient.clientId;
		clientSecret = registeredClient.clientSecret;
	}

	return { issuer, clientId, clientSecret, redirectUri: redirectUriFor(origin) };
}

// Discovery and the JWKS are cached for the process lifetime. Both are stable,
// and re-fetching them on every sign-in would put the provider on the critical
// path of every login twice over.
let discoveryCache: { issuer: string; value: Promise<Discovery> } | null = null;
let jwksCache: { uri: string; value: ReturnType<typeof createRemoteJWKSet> } | null = null;

export async function discover(issuer: string): Promise<Discovery> {
	if (discoveryCache?.issuer === issuer) return discoveryCache.value;

	const value = (async () => {
		const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
			signal: AbortSignal.timeout(10_000)
		});
		if (!response.ok) {
			throw new Error(`OIDC discovery failed: ${response.status}`);
		}
		const doc = (await response.json()) as Discovery;

		// The issuer in the document must match where we fetched it from, or a
		// misconfigured proxy could point us at someone else's provider.
		if (doc.issuer.replace(/\/$/, '') !== issuer) {
			throw new Error(`OIDC issuer mismatch: expected ${issuer}, got ${doc.issuer}`);
		}
		return doc;
	})();

	// Cache the promise, but drop it on failure so a transient outage does not
	// poison the process permanently.
	discoveryCache = { issuer, value };
	value.catch(() => {
		if (discoveryCache?.value === value) discoveryCache = null;
	});

	return value;
}

function getJwks(uri: string) {
	if (jwksCache?.uri !== uri) {
		jwksCache = { uri, value: createRemoteJWKSet(new URL(uri)) };
	}
	return jwksCache.value;
}

/** RFC 7636 S256. `verifier` goes in a cookie; only its hash crosses the wire. */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const verifier = base64url(bytes);
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function randomToken(bytes = 32): string {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64url(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64url');
}

export async function authorizationUrl(
	config: OidcConfig,
	params: { state: string; nonce: string; challenge: string }
): Promise<string> {
	const { authorization_endpoint } = await discover(config.issuer);

	const url = new URL(authorization_endpoint);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', config.clientId);
	url.searchParams.set('redirect_uri', config.redirectUri);
	url.searchParams.set('scope', SCOPES);
	url.searchParams.set('state', params.state);
	url.searchParams.set('nonce', params.nonce);
	url.searchParams.set('code_challenge', params.challenge);
	url.searchParams.set('code_challenge_method', 'S256');
	return url.toString();
}

interface TokenResponse {
	access_token: string;
	id_token: string;
	token_type: string;
	expires_in?: number;
	refresh_token?: string;
}

function basicAuth(config: OidcConfig): Record<string, string> {
	// client_secret_basic for a confidential client. A public client has no
	// secret and authenticates as `none`: the `client_id` in the body identifies
	// it, and PKCE is what proves the code is ours. Sending an empty Basic header
	// instead would be rejected outright — the provider refuses a secret from a
	// client it holds none for.
	if (!config.clientSecret) return {};
	const credentials = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`;
	return { authorization: `Basic ${Buffer.from(credentials).toString('base64')}` };
}

export async function exchangeCode(
	config: OidcConfig,
	params: { code: string; verifier: string }
): Promise<TokenResponse> {
	const { token_endpoint } = await discover(config.issuer);

	const response = await fetch(token_endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			...basicAuth(config)
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code: params.code,
			redirect_uri: config.redirectUri,
			code_verifier: params.verifier,
			client_id: config.clientId
		}),
		signal: AbortSignal.timeout(10_000)
	});

	if (!response.ok) {
		// Deliberately not including the response body: it can echo back request
		// parameters, and this string ends up in logs.
		throw new Error(`Token exchange failed: ${response.status}`);
	}

	return (await response.json()) as TokenResponse;
}

/**
 * Verifies the id_token signature and claims.
 *
 * The token arrived over TLS straight from the token endpoint, so the spec
 * allows skipping this. Doing it anyway is cheap and checks issuer, audience,
 * expiry and the nonce in one pass — which catches a replayed or swapped token,
 * not just a forged one.
 */
export async function verifyIdToken(
	config: OidcConfig,
	idToken: string,
	expectedNonce?: string
): Promise<Claims> {
	const { jwks_uri } = await discover(config.issuer);

	const { payload } = await jwtVerify(idToken, getJwks(jwks_uri), {
		issuer: config.issuer,
		audience: config.clientId,
		clockTolerance: 30
	});

	// Only on the authorization-code leg. A token minted by the refresh grant
	// carries no nonce, and requiring one there would reject every refresh.
	if (expectedNonce !== undefined && payload.nonce !== expectedNonce) {
		throw new Error('id_token nonce mismatch');
	}
	if (typeof payload.sub !== 'string' || !payload.sub) {
		throw new Error('id_token has no subject');
	}

	return toClaims(payload);
}

function toClaims(payload: JWTPayload): Claims {
	const claims: Claims = { sub: payload.sub as string, permissions: [] };
	const str = (key: string) =>
		typeof payload[key] === 'string' ? (payload[key] as string) : undefined;

	// The provider returns maps keyed by application slug, not narrowed to the
	// requesting client. Read only our own entry; another app's grants are none
	// of Ledgerly's business even though they arrive in the same claim.
	const permissionMap = payload[PERMISSIONS_CLAIM] as Record<string, unknown> | undefined;
	const ours = permissionMap?.[SLUG];
	claims.permissions = Array.isArray(ours) ? ours.filter((p) => typeof p === 'string') : [];

	const roleMap = payload[ROLES_CLAIM] as Record<string, unknown> | undefined;
	const role = roleMap?.[SLUG];
	if (typeof role === 'string') claims.role = role;

	claims.email = str('email');
	claims.name = str('name');
	claims.preferred_username = str('preferred_username');
	claims.picture = str('picture');
	if (typeof payload.email_verified === 'boolean') {
		claims.email_verified = payload.email_verified;
	}
	return claims;
}

export async function endSessionUrl(
	config: OidcConfig,
	idTokenHint?: string
): Promise<string | null> {
	const { end_session_endpoint } = await discover(config.issuer);
	if (!end_session_endpoint) return null;

	const url = new URL(end_session_endpoint);
	if (idTokenHint) url.searchParams.set('id_token_hint', idTokenHint);
	url.searchParams.set('post_logout_redirect_uri', new URL('/', config.redirectUri).toString());
	return url.toString();
}

/**
 * Exchanges a refresh token for a fresh id_token.
 *
 * Used to re-read permissions rather than to keep an access token alive: the
 * provider revokes the refresh token when a grant is withdrawn, so a failure
 * here is itself the signal that someone's access has been taken away.
 */
export async function refreshClaims(
	config: OidcConfig,
	refreshToken: string
): Promise<{ claims: Claims; refreshToken: string }> {
	const { token_endpoint } = await discover(config.issuer);

	const response = await fetch(token_endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			...basicAuth(config)
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: config.clientId
		}),
		signal: AbortSignal.timeout(10_000)
	});

	if (!response.ok) {
		throw new Error(`Refresh failed: ${response.status}`);
	}

	const tokens = (await response.json()) as { id_token?: string; refresh_token?: string };
	if (!tokens.id_token) throw new Error('Refresh returned no id_token');

	return {
		claims: await verifyIdToken(config, tokens.id_token),
		// Providers may rotate refresh tokens; keep whichever came back.
		refreshToken: tokens.refresh_token ?? refreshToken
	};
}
