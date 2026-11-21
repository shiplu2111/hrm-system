-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "pending_plan_id" UUID;

-- CreateIndex
CREATE INDEX "subscriptions_pending_plan_id_idx" ON "subscriptions"("pending_plan_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_plan_id_fkey" FOREIGN KEY ("pending_plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
