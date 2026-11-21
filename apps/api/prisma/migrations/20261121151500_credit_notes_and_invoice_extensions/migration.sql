-- AlterTable invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pdf_key" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_reason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50);

-- CreateTable credit_notes
CREATE TABLE IF NOT EXISTS "credit_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'issued',
    "issued_by" VARCHAR(255) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_credit_note_number_key" ON "credit_notes"("credit_note_number");
CREATE INDEX IF NOT EXISTS "credit_notes_tenant_id_idx" ON "credit_notes"("tenant_id");
CREATE INDEX IF NOT EXISTS "credit_notes_invoice_id_idx" ON "credit_notes"("invoice_id");
CREATE INDEX IF NOT EXISTS "credit_notes_credit_note_number_idx" ON "credit_notes"("credit_note_number");
