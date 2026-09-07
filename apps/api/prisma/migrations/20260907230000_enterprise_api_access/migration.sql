-- Enterprise API access: scoped API keys and OAuth (MODULES.md §43)

CREATE TYPE "tenant_api_key_status" AS ENUM ('active', 'revoked');
CREATE TYPE "tenant_oauth_client_status" AS ENUM ('active', 'revoked');

CREATE TABLE "tenant_api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "tenant_api_key_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_oauth_clients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client_secret_hash" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "scopes" TEXT[],
    "status" "tenant_oauth_client_status" NOT NULL DEFAULT 'active',
    "created_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_oauth_authorization_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scopes" TEXT[],
    "redirect_uri" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_oauth_access_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "client_id" UUID,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_api_keys_prefix_key" ON "tenant_api_keys"("prefix");
CREATE INDEX "tenant_api_keys_tenant_id_status_idx" ON "tenant_api_keys"("tenant_id", "status");
CREATE INDEX "tenant_api_keys_key_hash_idx" ON "tenant_api_keys"("key_hash");

CREATE INDEX "tenant_oauth_clients_tenant_id_status_idx" ON "tenant_oauth_clients"("tenant_id", "status");

CREATE UNIQUE INDEX "tenant_oauth_authorization_codes_code_key" ON "tenant_oauth_authorization_codes"("code");
CREATE INDEX "tenant_oauth_authorization_codes_client_id_idx" ON "tenant_oauth_authorization_codes"("client_id");
CREATE INDEX "tenant_oauth_authorization_codes_expires_at_idx" ON "tenant_oauth_authorization_codes"("expires_at");

CREATE UNIQUE INDEX "tenant_oauth_access_tokens_token_hash_key" ON "tenant_oauth_access_tokens"("token_hash");
CREATE INDEX "tenant_oauth_access_tokens_tenant_id_idx" ON "tenant_oauth_access_tokens"("tenant_id");
CREATE INDEX "tenant_oauth_access_tokens_expires_at_idx" ON "tenant_oauth_access_tokens"("expires_at");

ALTER TABLE "tenant_api_keys" ADD CONSTRAINT "tenant_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_oauth_clients" ADD CONSTRAINT "tenant_oauth_clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_oauth_authorization_codes" ADD CONSTRAINT "tenant_oauth_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "tenant_oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_oauth_access_tokens" ADD CONSTRAINT "tenant_oauth_access_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_oauth_access_tokens" ADD CONSTRAINT "tenant_oauth_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "tenant_oauth_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
