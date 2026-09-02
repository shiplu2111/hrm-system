-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('create', 'update', 'delete', 'approve', 'finalize', 'reject', 'suspend', 'restore');

-- CreateEnum
CREATE TYPE "permission_action" AS ENUM ('view', 'create', 'edit', 'delete', 'approve', 'finalize');

-- CreateEnum
CREATE TYPE "tenant_setting_category" AS ENUM ('smtp', 'notification', 'integration', 'branding', 'feature_flag');

-- CreateEnum
CREATE TYPE "platform_setting_category" AS ENUM ('smtp_default', 'notification_default', 'country_config', 'maintenance');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID NOT NULL,
    "action" "audit_action" NOT NULL,
    "module" TEXT NOT NULL,
    "record_id" UUID NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "action" "permission_action" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category" "tenant_setting_category" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "category" "platform_setting_category" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_module_idx" ON "audit_logs"("tenant_id", "module");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_record_id_idx" ON "audit_logs"("tenant_id", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE INDEX "permissions_role_id_idx" ON "permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_role_id_module_action_key" ON "permissions"("role_id", "module", "action");

-- CreateIndex
CREATE INDEX "tenant_settings_tenant_id_idx" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_settings_tenant_id_category_idx" ON "tenant_settings"("tenant_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_category_key_key" ON "tenant_settings"("tenant_id", "category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_category_key_key" ON "platform_settings"("category", "key");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only enforcement (AUDIT_LOG.md §2, DATABASE_SCHEMA.md §9)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();

-- Revoke mutation privileges from all roles except superuser (defence in depth)
REVOKE UPDATE, DELETE ON TABLE "audit_logs" FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- roles: unique name per tenant; unique name among system roles (tenant_id IS NULL)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "roles_tenant_id_name_key"
  ON "roles"("tenant_id", "name")
  WHERE "tenant_id" IS NOT NULL;

CREATE UNIQUE INDEX "roles_system_name_key"
  ON "roles"("name")
  WHERE "tenant_id" IS NULL;
