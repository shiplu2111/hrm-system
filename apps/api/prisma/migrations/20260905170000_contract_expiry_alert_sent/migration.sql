-- Track when contract expiry alert was sent (NOTIFICATION_LOGIC.md contract.expiring)

ALTER TABLE "employment_contracts"
  ADD COLUMN "expiry_alert_sent_at" TIMESTAMP(3);
