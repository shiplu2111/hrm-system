-- AlterTable
ALTER TABLE "benefit_plans"
    ADD COLUMN "allows_dependents" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "max_dependents" INTEGER,
    ADD COLUMN "eligible_relationships" "benefit_dependent_relationship"[] NOT NULL DEFAULT ARRAY[]::"benefit_dependent_relationship"[],
    ADD COLUMN "dependent_contribution_amount" DECIMAL(14,2);
