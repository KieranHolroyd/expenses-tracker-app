import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Handle } from '@sveltejs/kit';

/**
 * Names the request span after the route template rather than the URL.
 *
 * The HTTP auto-instrumentation only sees the raw path, so `/vault/a1b2` and
 * `/vault/c3d4` arrive as two different span names — which makes "how slow is
 * this endpoint" an unanswerable question, and quietly grows the label
 * cardinality of every metric derived from those spans. SvelteKit knows the
 * template that matched, so we substitute it once the route has resolved.
 *
 * Everything here is a no-op when the SDK was never started: the OpenTelemetry
 * API hands back a non-recording span, and setting attributes on it does
 * nothing at all.
 */
export const telemetryHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	const span = trace.getActiveSpan();
	if (span && event.route.id) {
		span.updateName(`${event.request.method} ${event.route.id}`);
		span.setAttribute('http.route', event.route.id);
	}

	return response;
};

/**
 * Attaches a thrown error to the span for the request that produced it, so a
 * failed trace carries the stack rather than only a 500.
 *
 * Call this from `handleError`; it deliberately does not log, because each app
 * already decides for itself what belongs in its own logs.
 */
export function recordException(error: unknown, message?: string): void {
	const span = trace.getActiveSpan();
	if (!span) return;

	span.recordException(error instanceof Error ? error : new Error(String(error)));
	span.setStatus({
		code: SpanStatusCode.ERROR,
		message: message ?? (error instanceof Error ? error.message : String(error))
	});
}
