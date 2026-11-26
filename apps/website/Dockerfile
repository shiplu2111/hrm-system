# Multi-stage container build for @hrm/website (run from monorepo root: docker build -f apps/website/Dockerfile .)
FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_APP_ENV=development
ARG SITE_IS_STAGING=true
ARG NEXT_PUBLIC_SITE_URL=http://localhost:5180
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_PORTAL_URL=http://localhost:5174
ARG NEXT_PUBLIC_PLATFORM_URL=http://localhost:5176
ARG NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS=10

ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV SITE_IS_STAGING=$SITE_IS_STAGING
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_PLATFORM_URL=$NEXT_PUBLIC_PLATFORM_URL
ENV NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS=$NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/portal-ui/package.json packages/portal-ui/
COPY packages/i18n/package.json packages/i18n/
COPY apps/website/package.json apps/website/

RUN npm ci --workspace=@hrm/website --workspace=@hrm/shared-types --workspace=@hrm/portal-ui --include-workspace-root

COPY packages/shared-types packages/shared-types/
COPY packages/portal-ui packages/portal-ui/
COPY apps/website apps/website/

RUN npm run build -w @hrm/shared-types && npm run build -w @hrm/website && npm run security:scan -w @hrm/website

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5180

RUN addgroup -S hrm && adduser -S hrm -G hrm

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/packages/portal-ui ./packages/portal-ui
COPY --from=builder /app/apps/website/.next ./apps/website/.next
COPY --from=builder /app/apps/website/public ./apps/website/public
COPY --from=builder /app/apps/website/package.json ./apps/website/package.json
COPY --from=builder /app/apps/website/next.config.ts ./apps/website/next.config.ts
COPY --from=builder /app/apps/website/src/content ./apps/website/src/content

RUN chown -R hrm:hrm /app
USER hrm
EXPOSE 5180

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5180/robots.txt').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start", "-w", "@hrm/website"]
