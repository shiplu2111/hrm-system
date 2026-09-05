-- Optional trigger conditions for workflow definitions (MODULES.md §35)

ALTER TABLE "workflow_definitions"
  ADD COLUMN "trigger_config" JSONB;
