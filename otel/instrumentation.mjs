// OpenTelemetry bootstrap. Loaded before the application with
//
//   node --import ./otel/instrumentation.mjs build
//
// so that the auto-instrumentations can patch http, postgres, fetch and the
// rest before SvelteKit's server ever imports them. Loading it from inside the
// app — a top-level import in hooks.server.ts, say — is too late: by then the
// modules it needs to wrap are already resolved, and the traces come out empty.
//
// Everything is off unless OTEL_EXPORTER_OTLP_ENDPOINT is set. `pnpm dev`, a
// bare `node build`, and anyone running this image without the collector all
// behave exactly as they did before.

import { register } from 'node:module';
import { hostname } from 'node:os';

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_INSTANCE_ID,
	ATTR_SERVICE_NAMESPACE,
	ATTR_SERVICE_VERSION
} from '@opentelemetry/semantic-conventions';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const disabled = process.env.OTEL_SDK_DISABLED === 'true';

if (endpoint && !disabled) {
	if (process.env.OTEL_LOG_LEVEL) {
		const level = process.env.OTEL_LOG_LEVEL.toUpperCase();
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel[level] ?? DiagLogLevel.INFO);
	}

	// The application is ESM (adapter-node emits ES modules), so patching by
	// monkey-patching `require` is not enough — the loader hook is what lets the
	// instrumentations intercept `import` as well. Must be registered before the
	// app's own graph is loaded, which is why this file runs under --import.
	register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

	const attributes = {
		[ATTR_SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE || 'holroydnet',
		[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
		// Distinguishes replicas of the same service. Inside Docker the hostname
		// is the short container id, which is exactly what we want.
		[ATTR_SERVICE_INSTANCE_ID]: process.env.OTEL_SERVICE_INSTANCE_ID || hostname()
	};
	if (process.env.OTEL_SERVICE_VERSION) {
		attributes[ATTR_SERVICE_VERSION] = process.env.OTEL_SERVICE_VERSION;
	}

	const resource = defaultResource().merge(resourceFromAttributes(attributes));

	// Health checks and hashed static assets are the bulk of the request volume
	// and none of the interest. Dropping them at the source keeps Tempo's
	// retention spent on real traffic.
	const ignoredPaths = [/^\/healthz/, /^\/_app\//, /^\/favicon\./, /^\/robots\.txt/];

	const sdk = new NodeSDK({
		resource,
		traceExporter: new OTLPTraceExporter(),
		metricReaders: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter(),
				exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL || 30_000)
			})
		],
		// Nothing emits OTLP logs today — the apps log to stdout and Alloy ships
		// those to Loki from the Docker socket. This pipeline is here so that a
		// structured logger (pino, winston) starts exporting the moment one is
		// added, already correlated with the trace it ran under.
		logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
		instrumentations: [
			getNodeAutoInstrumentations({
				// Every read of a Svelte component or a static file would otherwise
				// become a span. Enormous volume, no diagnostic value.
				'@opentelemetry/instrumentation-fs': { enabled: false },
				// DNS resolution spans are similarly noisy and rarely the answer.
				'@opentelemetry/instrumentation-dns': { enabled: false },
				'@opentelemetry/instrumentation-net': { enabled: false },
				'@opentelemetry/instrumentation-http': {
					ignoreIncomingRequestHook: (request) => {
						const path = (request.url || '').split('?')[0];
						return ignoredPaths.some((pattern) => pattern.test(path));
					}
				}
			})
		]
	});

	sdk.start();

	// adapter-node installs its own SIGTERM/SIGINT handlers and exits once the
	// HTTP server has closed. Ours only flushes; it deliberately does not call
	// process.exit, which would cut the server's own drain short.
	for (const signal of ['SIGTERM', 'SIGINT']) {
		process.on(signal, () => {
			sdk.shutdown().catch((error) => {
				// eslint-disable-next-line no-console
				console.error('[otel] shutdown failed', error);
			});
		});
	}
}
