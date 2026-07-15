ALTER TABLE "contract"."contract_works_progress_reports"
  ADD COLUMN IF NOT EXISTS "programme_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

ALTER TABLE "contract"."contract_boq_measurements"
  ADD COLUMN IF NOT EXISTS "measurement_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "certified_quantity" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "certified_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

ALTER TABLE "contract"."contract_interim_payment_certificates"
  ADD COLUMN IF NOT EXISTS "measurement_id" UUID,
  ADD COLUMN IF NOT EXISTS "certificate_type" TEXT NOT NULL DEFAULT 'INTERIM',
  ADD COLUMN IF NOT EXISTS "retention_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "advance_recovery_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "liquidated_damages_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "tax_withholding_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "other_deductions_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "certified_amount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

CREATE INDEX IF NOT EXISTS "contract_interim_payment_certificates_measurement_id_idx"
  ON "contract"."contract_interim_payment_certificates"("measurement_id");

CREATE INDEX IF NOT EXISTS "contract_interim_payment_certificates_contract_id_certificate_type_idx"
  ON "contract"."contract_interim_payment_certificates"("contract_id", "certificate_type");

CREATE TABLE IF NOT EXISTS "contract"."contract_works_completion_certificates" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "certificate_number" TEXT NOT NULL,
  "certificate_type" TEXT NOT NULL DEFAULT 'PRACTICAL_COMPLETION',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "progress_report_id" UUID,
  "ipc_id" UUID,
  "completion_date" TIMESTAMP(3),
  "defects_summary" TEXT,
  "outstanding_works" TEXT,
  "final_account_amount" DECIMAL(18,2),
  "retention_release_amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "issued_by_user_id" UUID,
  "issued_at" TIMESTAMP(3),
  "note" TEXT,
  "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_works_completion_certificates_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contract_works_completion_certificates_contract_id_fkey'
  ) THEN
    ALTER TABLE "contract"."contract_works_completion_certificates"
      ADD CONSTRAINT "contract_works_completion_certificates_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "contract_works_completion_certificates_contract_id_certificate_number_key"
  ON "contract"."contract_works_completion_certificates"("contract_id", "certificate_number");

CREATE INDEX IF NOT EXISTS "contract_works_completion_certificates_contract_id_certificate_type_idx"
  ON "contract"."contract_works_completion_certificates"("contract_id", "certificate_type");

CREATE INDEX IF NOT EXISTS "contract_works_completion_certificates_contract_id_status_idx"
  ON "contract"."contract_works_completion_certificates"("contract_id", "status");

CREATE INDEX IF NOT EXISTS "contract_works_completion_certificates_progress_report_id_idx"
  ON "contract"."contract_works_completion_certificates"("progress_report_id");

CREATE INDEX IF NOT EXISTS "contract_works_completion_certificates_ipc_id_idx"
  ON "contract"."contract_works_completion_certificates"("ipc_id");

ALTER TABLE "contract"."contract_defects"
  ADD COLUMN IF NOT EXISTS "source_record_type" TEXT,
  ADD COLUMN IF NOT EXISTS "source_record_id" UUID,
  ADD COLUMN IF NOT EXISTS "responsible_role" TEXT,
  ADD COLUMN IF NOT EXISTS "response_due_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verified_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

CREATE INDEX IF NOT EXISTS "contract_defects_source_record_type_source_record_id_idx"
  ON "contract"."contract_defects"("source_record_type", "source_record_id");

CREATE INDEX IF NOT EXISTS "contract_defects_responsible_role_status_idx"
  ON "contract"."contract_defects"("responsible_role", "status");
