ALTER TABLE "contract"."contract_service_reports"
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verified_sla_result" TEXT,
  ADD COLUMN IF NOT EXISTS "accepted_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "correction_due_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "corrected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

ALTER TABLE "contract"."contract_service_credits"
  ADD COLUMN IF NOT EXISTS "service_report_id" UUID,
  ADD COLUMN IF NOT EXISTS "invoice_impact_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "decision" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

CREATE INDEX IF NOT EXISTS "contract_service_credits_service_report_id_idx"
  ON "contract"."contract_service_credits"("service_report_id");

CREATE TABLE IF NOT EXISTS "contract"."contract_service_incidents" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "incident_reference" TEXT NOT NULL,
  "incident_type" TEXT NOT NULL DEFAULT 'INCIDENT',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MINOR',
  "service_level_id" UUID,
  "period_id" UUID,
  "service_report_id" UUID,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_date" TIMESTAMP(3),
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "responsible_role" TEXT,
  "response_due_date" TIMESTAMP(3),
  "responded_at" TIMESTAMP(3),
  "verified_by_user_id" UUID,
  "verified_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_service_incidents_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contract_service_incidents_contract_id_fkey'
  ) THEN
    ALTER TABLE "contract"."contract_service_incidents"
      ADD CONSTRAINT "contract_service_incidents_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "contract_service_incidents_contract_id_incident_reference_key"
  ON "contract"."contract_service_incidents"("contract_id", "incident_reference");

CREATE INDEX IF NOT EXISTS "contract_service_incidents_contract_id_status_idx"
  ON "contract"."contract_service_incidents"("contract_id", "status");

CREATE INDEX IF NOT EXISTS "contract_service_incidents_period_id_idx"
  ON "contract"."contract_service_incidents"("period_id");

CREATE INDEX IF NOT EXISTS "contract_service_incidents_service_report_id_idx"
  ON "contract"."contract_service_incidents"("service_report_id");

CREATE INDEX IF NOT EXISTS "contract_service_incidents_responsible_role_status_idx"
  ON "contract"."contract_service_incidents"("responsible_role", "status");
