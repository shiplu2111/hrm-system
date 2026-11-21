-- CreateEnum
CREATE TYPE "custom_domain_status" AS ENUM ('pending_verification', 'verified', 'dns_failed', 'provisioning_tls', 'active', 'failed', 'disabled');

-- CreateEnum
CREATE TYPE "tls_certificate_status" AS ENUM ('pending', 'provisioning', 'active', 'failed', 'expired');

-- CreateTable
CREATE TABLE "tenant_brandings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#2563EB',
    "secondary_color" TEXT,
    "company_display_name" TEXT,
    "sender_name" TEXT,
    "sender_email" TEXT,
    "email_header_logo_url" TEXT,
    "email_footer_text" TEXT,
    "custom_css" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_brandings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_custom_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "custom_domain_status" NOT NULL DEFAULT 'pending_verification',
    "verification_token" TEXT NOT NULL,
    "dns_records" JSONB NOT NULL,
    "ssl_status" "tls_certificate_status" NOT NULL DEFAULT 'pending',
    "ssl_certificate_id" TEXT,
    "ssl_issued_at" TIMESTAMP(3),
    "ssl_expires_at" TIMESTAMP(3),
    "ssl_details" JSONB,
    "verified_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_custom_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_brandings_tenant_id_key" ON "tenant_brandings"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_brandings_tenant_id_idx" ON "tenant_brandings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_custom_domains_domain_key" ON "tenant_custom_domains"("domain");

-- CreateIndex
CREATE INDEX "tenant_custom_domains_tenant_id_idx" ON "tenant_custom_domains"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_custom_domains_status_idx" ON "tenant_custom_domains"("status");

-- CreateIndex
CREATE INDEX "tenant_custom_domains_domain_idx" ON "tenant_custom_domains"("domain");

-- AddForeignKey
ALTER TABLE "tenant_brandings" ADD CONSTRAINT "tenant_brandings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_custom_domains" ADD CONSTRAINT "tenant_custom_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
