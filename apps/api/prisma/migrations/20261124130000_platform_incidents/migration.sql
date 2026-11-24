-- CreateTable platform_incidents
CREATE TABLE IF NOT EXISTS "platform_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incident_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subsystem" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "impact" TEXT NOT NULL,
    "root_cause" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "updates" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_incidents_incident_number_key" ON "platform_incidents"("incident_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_platform_incidents_subsystem" ON "platform_incidents"("subsystem");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_platform_incidents_status" ON "platform_incidents"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_platform_incidents_severity" ON "platform_incidents"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_platform_incidents_started_at" ON "platform_incidents"("started_at");
