// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Resolved once per request in hooks.server.ts. Null when signed out. */
			session: Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
