-- Country-specific incident reporting fields resolved via Rule Resolver (MODULES.md §30, Stage 29.1)

ALTER TABLE "workplace_incidents"
  ADD COLUMN "country_specific_data" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "regulator_reference_number" TEXT,
  ADD COLUMN "regulator_report_submitted_by_user_id" UUID,
  ADD COLUMN "resolved_rule_snapshot" JSONB;

CREATE INDEX "workplace_incidents_regulator_report_submitted_by_user_id_idx"
  ON "workplace_incidents"("regulator_report_submitted_by_user_id");

ALTER TABLE "workplace_incidents"
  ADD CONSTRAINT "workplace_incidents_regulator_report_submitted_by_user_id_fkey"
  FOREIGN KEY ("regulator_report_submitted_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Global default health_safety rule layer (base of Global -> Country -> State -> Company -> Contract)
INSERT INTO "global_rules" ("id", "rule_type", "payload", "effective_from", "created_at", "updated_at")
SELECT
  '10000000-0000-4000-8000-00000000029d'::uuid,
  'health_safety',
  '{
    "incidentReporting": {
      "regulatorReportRequiredSeverities": ["critical"],
      "notifiableIncidentTypes": ["injury"],
      "regulatorReportDeadlineHours": 48,
      "regulatorReferenceLabel": "Regulatory Notification Reference",
      "reportingFields": [
        {
          "key": "immediateContainmentActions",
          "label": "Immediate Containment & Make-Safe Actions",
          "type": "textarea",
          "required": false,
          "placeholder": "Describe area isolation, lock-out/tag-out, or medical response taken."
        }
      ]
    },
    "injuryLog": {
      "retentionYears": 5,
      "requireBodyPart": false
    }
  }'::jsonb,
  DATE '2024-07-01',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "global_rules" WHERE "id" = '10000000-0000-4000-8000-00000000029d'::uuid
);

-- Enrich seeded country rule (AUS / Safe Work Australia) with statutory reporting fields metadata
UPDATE "country_rules"
SET
  "payload" = jsonb_set(
    jsonb_set(
      "payload"::jsonb,
      '{incidentReporting,regulatorReferenceLabel}',
      '"Safe Work Notification Reference"'::jsonb,
      true
    ),
    '{incidentReporting,reportingFields}',
    '[
      {
        "key": "notifiableIncidentCategory",
        "label": "WHS Notifiable Category",
        "type": "select",
        "requiredWhenRegulatorNotifiable": true,
        "helpText": "Model WHS Act s.35–37 classification resolved from country rules.",
        "options": [
          { "value": "death", "label": "Death of a person" },
          { "value": "serious_injury_illness", "label": "Serious injury or illness" },
          { "value": "dangerous_incident", "label": "Dangerous incident (collapse / explosion / electric shock)" },
          { "value": "non_notifiable", "label": "Internal / non-notifiable incident" }
        ]
      },
      {
        "key": "incidentSitePreserved",
        "label": "Incident site preserved (WHS Act s.39)",
        "type": "boolean",
        "requiredWhenRegulatorNotifiable": true,
        "helpText": "Confirm whether the scene was preserved until inspector clearance."
      },
      {
        "key": "jurisdictionAuthority",
        "label": "State / Territory WHS Regulator",
        "type": "text",
        "placeholder": "e.g. SafeWork NSW, WorkSafe Victoria",
        "helpText": "Authority notified under the company jurisdiction."
      },
      {
        "key": "workersCompClaimRef",
        "label": "Workers Compensation Claim Ref",
        "type": "text",
        "placeholder": "e.g. WC-2026-00412"
      },
      {
        "key": "immediateContainmentActions",
        "label": "Immediate Containment & Make-Safe Actions",
        "type": "textarea",
        "required": true,
        "placeholder": "Describe area isolation, hazard controls, or emergency aid provided."
      }
    ]'::jsonb,
    true
  ),
  "updated_at" = NOW()
WHERE "id" = '10000000-0000-4000-8000-000000000009'::uuid
  AND "rule_type" = 'health_safety';
