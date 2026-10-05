-- CreateTable
CREATE TABLE "gl_cost_centre_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "cost_centre_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "pay_component_id" UUID,
    "gl_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_cost_centre_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gl_cost_centre_mappings_tenant_id_idx" ON "gl_cost_centre_mappings"("tenant_id");

-- CreateIndex
CREATE INDEX "gl_cost_centre_mappings_company_id_idx" ON "gl_cost_centre_mappings"("company_id");

-- CreateIndex
CREATE INDEX "gl_cost_centre_mappings_gl_account_id_idx" ON "gl_cost_centre_mappings"("gl_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "gl_cost_centre_mappings_cost_centre_id_source_key_key" ON "gl_cost_centre_mappings"("cost_centre_id", "source_key");

-- AddForeignKey
ALTER TABLE "gl_cost_centre_mappings" ADD CONSTRAINT "gl_cost_centre_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_cost_centre_mappings" ADD CONSTRAINT "gl_cost_centre_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_cost_centre_mappings" ADD CONSTRAINT "gl_cost_centre_mappings_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "cost_centres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_cost_centre_mappings" ADD CONSTRAINT "gl_cost_centre_mappings_pay_component_id_fkey" FOREIGN KEY ("pay_component_id") REFERENCES "pay_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_cost_centre_mappings" ADD CONSTRAINT "gl_cost_centre_mappings_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
