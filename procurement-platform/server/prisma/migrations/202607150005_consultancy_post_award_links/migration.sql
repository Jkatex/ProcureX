ALTER TABLE "contract"."contract_consultancy_deliverables"
  ADD COLUMN "accepted_amount" DECIMAL(18, 2),
  ADD COLUMN "reviewed_by_user_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "approval_status" TEXT,
  ADD COLUMN "is_final_report" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

ALTER TABLE "contract"."contract_deliverable_versions"
  ADD COLUMN "previous_version_id" UUID,
  ADD COLUMN "revision_reason" TEXT,
  ADD COLUMN "correction_due_date" TIMESTAMP(3),
  ADD COLUMN "corrected_at" TIMESTAMP(3),
  ADD COLUMN "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

ALTER TABLE "contract"."contract_deliverable_reviews"
  ADD COLUMN "comment_summary" TEXT,
  ADD COLUMN "buyer_private_notes" TEXT,
  ADD COLUMN "payment_eligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accepted_amount" DECIMAL(18, 2),
  ADD COLUMN "revision_due_date" TIMESTAMP(3),
  ADD COLUMN "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

CREATE TABLE "contract"."contract_consultancy_final_reports" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "report_reference" TEXT NOT NULL,
  "deliverable_id" UUID,
  "version_id" UUID,
  "document_id" UUID,
  "submitted_by_org_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'SUBMITTED',
  "summary" TEXT,
  "accepted_amount" DECIMAL(18, 2),
  "payment_eligible" BOOLEAN NOT NULL DEFAULT false,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_consultancy_final_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_consultancy_final_reports_contract_id_report_reference_key"
  ON "contract"."contract_consultancy_final_reports"("contract_id", "report_reference");
CREATE INDEX "contract_consultancy_final_reports_contract_id_status_idx"
  ON "contract"."contract_consultancy_final_reports"("contract_id", "status");
CREATE INDEX "contract_consultancy_final_reports_deliverable_id_idx"
  ON "contract"."contract_consultancy_final_reports"("deliverable_id");
CREATE INDEX "contract_consultancy_final_reports_version_id_idx"
  ON "contract"."contract_consultancy_final_reports"("version_id");
CREATE INDEX "contract_deliverable_versions_previous_version_id_idx"
  ON "contract"."contract_deliverable_versions"("previous_version_id");

ALTER TABLE "contract"."contract_consultancy_final_reports"
  ADD CONSTRAINT "contract_consultancy_final_reports_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
