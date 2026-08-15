import type { Handle, ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getSession } from '$lib/server/auth';
import { startRegistration } from '$lib/server/registration';
import { telemetryHandle } from '$lib/server/telemetry';

/**
 * Runs once when the server process starts.
 *
 * Claiming (or refreshing) Ledgerly's OIDC client is deliberately not awaited:
 * the provider being slow or down must not hold up serving the app, and
 * registration retries on its own.
 */
export const init: ServerInit = () => {
	startRegistration();
};

/**
 * Resolves the session once per request and hands it to load functions and
 * actions via `locals`.
 *
 * Note what this does NOT do: it does not gate any route. Access is enforced
 * where the data is reached — in `requireProfile` and its callers — because a
 * profile guard that already runs on every page carrying expenses is one gate
 * rather than two, and a central path matcher is the kind of thing that gets
 * forgotten when a route is added.
 */
const sessionHandle: Handle = async ({ event, resolve }) => {
	event.locals.session = await getSession(event.cookies);
	return resolve(event);
};

// Telemetry goes first so its span covers session resolution too — a slow
// session lookup is exactly the kind of thing worth seeing in a trace.
export const handle = sequence(telemetryHandle, sessionHandle);
