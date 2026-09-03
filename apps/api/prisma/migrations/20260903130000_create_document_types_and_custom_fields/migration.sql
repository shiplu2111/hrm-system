-- Custom field engine & document types (MODULES.md §09)

CREATE TYPE "custom_field_entity_type" AS ENUM (
  'employee',
  'company',
  'department',
  'designation',
  'contract',
  'candidate',
  'document'
);

CREATE TYPE "custom_field_type" AS ENUM (
  'text',
  'number',
  'date',
  'dropdown',
  'checkbox',
  'radio',
  'file',
  'image',
  'signature'
);

CREATE TYPE "document_scope" AS ENUM ('employee', 'company');

CREATE TABLE "document_types" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" "document_scope" NOT NULL DEFAULT 'employee',
  "requires_verification" BOOLEAN NOT NULL DEFAULT false,
  "tracks_expiry" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "custom_field_definitions" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "entity_type" "custom_field_entity_type" NOT NULL,
  "context_id" UUID,
  "field_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "field_type" "custom_field_type" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB NOT NULL DEFAULT '[]',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_field_definitions_company_id_entity_type_context_id_field_key_key"
  ON "custom_field_definitions"("company_id", "entity_type", "context_id", "field_key");

CREATE INDEX "custom_field_definitions_company_id_entity_type_idx"
  ON "custom_field_definitions"("company_id", "entity_type");

CREATE INDEX "custom_field_definitions_context_id_idx"
  ON "custom_field_definitions"("context_id");

CREATE UNIQUE INDEX "document_types_company_id_name_key"
  ON "document_types"("company_id", "name");

CREATE INDEX "document_types_company_id_idx" ON "document_types"("company_id");

ALTER TABLE "employee_documents" ALTER COLUMN "file_key" DROP NOT NULL;

ALTER TABLE "document_types"
  ADD CONSTRAINT "document_types_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "custom_field_definitions"
  ADD CONSTRAINT "custom_field_definitions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "custom_field_definitions"
  ADD CONSTRAINT "custom_field_definitions_context_id_fkey"
  FOREIGN KEY ("context_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_document_type_id_fkey"
  FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
