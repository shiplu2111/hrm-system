-- Applies 20260907112314_test2's renames on databases built from scratch, where test2 ran before
-- these objects existed. No-op where test2 already renamed them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_performance_reviews_performance_lifecycle_event_id_fke') THEN
    ALTER TABLE "employee_performance_reviews" RENAME CONSTRAINT "employee_performance_reviews_performance_lifecycle_event_id_fke" TO "employee_performance_reviews_performance_lifecycle_event_i_fkey";
  END IF;
  IF to_regclass('public.benefit_open_enrollment_plans_open_enrollment_period_id_benefit') IS NOT NULL THEN
    ALTER INDEX "benefit_open_enrollment_plans_open_enrollment_period_id_benefit" RENAME TO "benefit_open_enrollment_plans_open_enrollment_period_id_ben_key";
  END IF;
  IF to_regclass('public.custom_field_definitions_company_id_entity_type_context_id_fiel') IS NOT NULL THEN
    ALTER INDEX "custom_field_definitions_company_id_entity_type_context_id_fiel" RENAME TO "custom_field_definitions_company_id_entity_type_context_id__key";
  END IF;
  IF to_regclass('public.exchange_rates_tenant_id_base_currency_quote_currency_effective') IS NOT NULL THEN
    ALTER INDEX "exchange_rates_tenant_id_base_currency_quote_currency_effective" RENAME TO "exchange_rates_tenant_id_base_currency_quote_currency_effec_idx";
  END IF;
  IF to_regclass('public.workflow_definitions_company_id_entity_type_is_default_is_activ') IS NOT NULL THEN
    ALTER INDEX "workflow_definitions_company_id_entity_type_is_default_is_activ" RENAME TO "workflow_definitions_company_id_entity_type_is_default_is_a_idx";
  END IF;
END $$;
