# NestJS API — DEPLOYMENT.md §3 (containerized backend)
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --workspace=@hrm/api --workspace=@hrm/shared-types --include-workspace-root --ignore-scripts

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build -w @hrm/shared-types
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S hrm && adduser -S hrm -G hrm
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
RUN mkdir -p /app/storage && chown -R hrm:hrm /app
USER hrm
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
