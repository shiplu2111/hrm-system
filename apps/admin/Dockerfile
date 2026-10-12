FROM node:22-alpine AS build
WORKDIR /app

# Copy package descriptors
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/portal-ui/package.json packages/portal-ui/
COPY packages/i18n/package.json packages/i18n/

# Install all workspace dependencies
RUN npm ci --ignore-scripts

# Copy source codes
COPY packages/ packages/
COPY apps/admin apps/admin

# Build dependencies and admin
RUN npm run build -w @hrm/shared-types || true
RUN npm run build -w @hrm/i18n || true
RUN npm run build -w @hrm/portal-ui || true
WORKDIR /app/apps/admin

# Provide default env for build
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine AS runner
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
