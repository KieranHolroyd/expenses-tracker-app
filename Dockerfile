# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
	&& corepack prepare pnpm@9.7.1 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM dependencies AS production-dependencies
RUN pnpm prune --prod

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN apk add --no-cache libstdc++

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node otel ./otel
COPY --chown=node:node package.json ./package.json

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/profiles').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

# --import loads the OpenTelemetry bootstrap ahead of the server so the
# auto-instrumentations can patch http and the libsql client before SvelteKit
# imports them. It is inert unless OTEL_EXPORTER_OTLP_ENDPOINT is set, so this
# image still runs identically with no collector in front of it.
CMD ["node", "--import", "./otel/instrumentation.mjs", "build"]
