ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'CLOSING';

CREATE TABLE "contract"."contract_activations" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "ready_for_activation" BOOLEAN NOT NULL DEFAULT false,
  "activated_at" TIMESTAMP(3),
  "activated_by_user_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_activations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_activation_items" (
  "id" UUID NOT NULL,
  "activation_id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "title" TEXT NOT NULL,
  "owner_role" TEXT NOT NULL DEFAULT 'buyer',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "document_id" UUID,
  "submitted_by_org_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "due_date" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_activation_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_baselines" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "baseline_type" TEXT NOT NULL DEFAULT 'ORIGINAL',
  "version_no" INTEGER NOT NULL DEFAULT 1,
  "contract_value" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "start_date" TIMESTAMP(3),
  "completion_date" TIMESTAMP(3),
  "scope_summary" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source_record_id" UUID,
  "approved_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_baselines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_obligations" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "obligation_type" TEXT NOT NULL DEFAULT 'GENERAL',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "owner_role" TEXT NOT NULL,
  "related_milestone_id" UUID,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "due_date" TIMESTAMP(3),
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "acceptance_method" TEXT,
  "acceptance_criteria" TEXT,
  "payment_eligible" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_obligations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_evidence_requirements" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "obligation_id" UUID,
  "milestone_id" UUID,
  "title" TEXT NOT NULL,
  "evidence_type" TEXT NOT NULL DEFAULT 'DOCUMENT',
  "owner_role" TEXT NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "due_date" TIMESTAMP(3),
  "document_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_evidence_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_delivery_schedules" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "obligation_id" UUID,
  "line_reference" TEXT,
  "description" TEXT NOT NULL,
  "planned_quantity" DECIMAL(18,4),
  "unit" TEXT,
  "delivery_location" TEXT,
  "planned_delivery_date" TIMESTAMP(3),
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_delivery_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_dispatch_notices" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "schedule_id" UUID,
  "dispatch_reference" TEXT NOT NULL,
  "carrier" TEXT,
  "tracking_reference" TEXT,
  "dispatched_quantity" DECIMAL(18,4),
  "expected_arrival_date" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DISPATCHED',
  "submitted_by_org_id" UUID,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_dispatch_notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_goods_receipts" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "dispatch_notice_id" UUID,
  "receipt_reference" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_by_user_id" UUID,
  "location" TEXT,
  "condition_at_receipt" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_goods_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_goods_receipt_lines" (
  "id" UUID NOT NULL,
  "receipt_id" UUID NOT NULL,
  "schedule_id" UUID,
  "description" TEXT NOT NULL,
  "ordered_quantity" DECIMAL(18,4),
  "received_quantity" DECIMAL(18,4),
  "accepted_quantity" DECIMAL(18,4),
  "rejected_quantity" DECIMAL(18,4),
  "unit" TEXT,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_site_handovers" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "handover_reference" TEXT NOT NULL,
  "handover_date" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "handed_over_by" TEXT,
  "received_by" TEXT,
  "constraints" TEXT,
  "status" TEXT NOT NULL DEFAULT 'HANDED_OVER',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_site_handovers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_works_progress_reports" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "report_reference" TEXT NOT NULL,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "progress_percent" DECIMAL(5,2),
  "narrative" TEXT,
  "submitted_by_org_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_works_progress_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_boq_measurements" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "report_id" UUID,
  "boq_item_reference" TEXT NOT NULL,
  "description" TEXT,
  "previous_quantity" DECIMAL(18,4),
  "current_quantity" DECIMAL(18,4),
  "cumulative_quantity" DECIMAL(18,4),
  "unit_rate" DECIMAL(18,4),
  "amount" DECIMAL(18,2),
  "status" TEXT NOT NULL DEFAULT 'MEASURED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_boq_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_interim_payment_certificates" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "certificate_number" TEXT NOT NULL,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "gross_amount" DECIMAL(18,2),
  "deductions_amount" DECIMAL(18,2),
  "net_amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approved_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_interim_payment_certificates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_defects" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "defect_reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MINOR',
  "identified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_date" TIMESTAMP(3),
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "closed_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_defects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_service_levels" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "metric_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "target_value" TEXT,
  "measurement_unit" TEXT,
  "credit_rule" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_service_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_service_periods" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "period_key" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_service_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_service_reports" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "period_id" UUID,
  "report_reference" TEXT NOT NULL,
  "submitted_by_org_id" UUID,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "summary" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_service_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_service_credits" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "service_level_id" UUID,
  "period_id" UUID,
  "credit_type" TEXT NOT NULL DEFAULT 'SERVICE_CREDIT',
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_service_credits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_consultancy_deliverables" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "deliverable_code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "due_date" TIMESTAMP(3),
  "payment_eligible" BOOLEAN NOT NULL DEFAULT false,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_consultancy_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_deliverable_versions" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "deliverable_id" UUID,
  "version_no" INTEGER NOT NULL DEFAULT 1,
  "document_id" UUID,
  "submitted_by_org_id" UUID,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_deliverable_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_deliverable_reviews" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "version_id" UUID,
  "decision" TEXT NOT NULL DEFAULT 'REVISION_REQUESTED',
  "reviewer_user_id" UUID,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comments" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_deliverable_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_claims" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "claim_reference" TEXT NOT NULL,
  "claim_type" TEXT NOT NULL DEFAULT 'GENERAL',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "raised_by_role" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_claim_responses" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "claim_id" UUID,
  "responder_role" TEXT NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
  "response" TEXT,
  "amount_approved" DECIMAL(18,2),
  "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_claim_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_extension_requests" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "request_reference" TEXT NOT NULL,
  "requested_by_role" TEXT NOT NULL,
  "reason" TEXT,
  "requested_end_date" TIMESTAMP(3),
  "impact_summary" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "decided_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_extension_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_amendments" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "amendment_reference" TEXT NOT NULL,
  "amendment_type" TEXT NOT NULL DEFAULT 'VARIATION',
  "title" TEXT NOT NULL,
  "reason" TEXT,
  "baseline_version_no" INTEGER,
  "value_delta" DECIMAL(18,2),
  "time_delta_days" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approved_at" TIMESTAMP(3),
  "signed_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_activations_contract_id_key" ON "contract"."contract_activations"("contract_id");
CREATE INDEX "contract_activations_status_idx" ON "contract"."contract_activations"("status");
CREATE UNIQUE INDEX "contract_activation_items_activation_id_title_key" ON "contract"."contract_activation_items"("activation_id", "title");
CREATE INDEX "contract_activation_items_contract_id_status_idx" ON "contract"."contract_activation_items"("contract_id", "status");
CREATE INDEX "contract_activation_items_due_date_idx" ON "contract"."contract_activation_items"("due_date");
CREATE UNIQUE INDEX "contract_baselines_contract_id_version_no_key" ON "contract"."contract_baselines"("contract_id", "version_no");
CREATE INDEX "contract_baselines_contract_id_status_idx" ON "contract"."contract_baselines"("contract_id", "status");
CREATE INDEX "contract_obligations_contract_id_status_idx" ON "contract"."contract_obligations"("contract_id", "status");
CREATE INDEX "contract_obligations_owner_role_due_date_idx" ON "contract"."contract_obligations"("owner_role", "due_date");
CREATE INDEX "contract_evidence_requirements_contract_id_status_idx" ON "contract"."contract_evidence_requirements"("contract_id", "status");
CREATE INDEX "contract_evidence_requirements_obligation_id_idx" ON "contract"."contract_evidence_requirements"("obligation_id");
CREATE INDEX "contract_evidence_requirements_milestone_id_idx" ON "contract"."contract_evidence_requirements"("milestone_id");
CREATE INDEX "contract_delivery_schedules_contract_id_status_idx" ON "contract"."contract_delivery_schedules"("contract_id", "status");
CREATE INDEX "contract_delivery_schedules_planned_delivery_date_idx" ON "contract"."contract_delivery_schedules"("planned_delivery_date");
CREATE INDEX "contract_dispatch_notices_contract_id_status_idx" ON "contract"."contract_dispatch_notices"("contract_id", "status");
CREATE INDEX "contract_dispatch_notices_schedule_id_idx" ON "contract"."contract_dispatch_notices"("schedule_id");
CREATE INDEX "contract_goods_receipts_contract_id_status_idx" ON "contract"."contract_goods_receipts"("contract_id", "status");
CREATE INDEX "contract_goods_receipts_dispatch_notice_id_idx" ON "contract"."contract_goods_receipts"("dispatch_notice_id");
CREATE INDEX "contract_goods_receipt_lines_receipt_id_idx" ON "contract"."contract_goods_receipt_lines"("receipt_id");
CREATE INDEX "contract_goods_receipt_lines_schedule_id_idx" ON "contract"."contract_goods_receipt_lines"("schedule_id");
CREATE INDEX "contract_site_handovers_contract_id_status_idx" ON "contract"."contract_site_handovers"("contract_id", "status");
CREATE INDEX "contract_works_progress_reports_contract_id_status_idx" ON "contract"."contract_works_progress_reports"("contract_id", "status");
CREATE INDEX "contract_works_progress_reports_period_end_idx" ON "contract"."contract_works_progress_reports"("period_end");
CREATE INDEX "contract_boq_measurements_contract_id_status_idx" ON "contract"."contract_boq_measurements"("contract_id", "status");
CREATE INDEX "contract_boq_measurements_report_id_idx" ON "contract"."contract_boq_measurements"("report_id");
CREATE UNIQUE INDEX "contract_ipc_contract_id_certificate_number_key" ON "contract"."contract_interim_payment_certificates"("contract_id", "certificate_number");
CREATE INDEX "contract_ipc_contract_id_status_idx" ON "contract"."contract_interim_payment_certificates"("contract_id", "status");
CREATE INDEX "contract_defects_contract_id_status_idx" ON "contract"."contract_defects"("contract_id", "status");
CREATE INDEX "contract_defects_due_date_idx" ON "contract"."contract_defects"("due_date");
CREATE UNIQUE INDEX "contract_service_levels_contract_id_metric_key_key" ON "contract"."contract_service_levels"("contract_id", "metric_key");
CREATE INDEX "contract_service_levels_contract_id_status_idx" ON "contract"."contract_service_levels"("contract_id", "status");
CREATE UNIQUE INDEX "contract_service_periods_contract_id_period_key_key" ON "contract"."contract_service_periods"("contract_id", "period_key");
CREATE INDEX "contract_service_periods_contract_id_status_idx" ON "contract"."contract_service_periods"("contract_id", "status");
CREATE INDEX "contract_service_reports_contract_id_status_idx" ON "contract"."contract_service_reports"("contract_id", "status");
CREATE INDEX "contract_service_reports_period_id_idx" ON "contract"."contract_service_reports"("period_id");
CREATE INDEX "contract_service_credits_contract_id_status_idx" ON "contract"."contract_service_credits"("contract_id", "status");
CREATE INDEX "contract_service_credits_period_id_idx" ON "contract"."contract_service_credits"("period_id");
CREATE UNIQUE INDEX "contract_consultancy_deliverables_contract_id_code_key" ON "contract"."contract_consultancy_deliverables"("contract_id", "deliverable_code");
CREATE INDEX "contract_consultancy_deliverables_contract_id_status_idx" ON "contract"."contract_consultancy_deliverables"("contract_id", "status");
CREATE UNIQUE INDEX "contract_deliverable_versions_deliverable_id_version_no_key" ON "contract"."contract_deliverable_versions"("deliverable_id", "version_no");
CREATE INDEX "contract_deliverable_versions_contract_id_status_idx" ON "contract"."contract_deliverable_versions"("contract_id", "status");
CREATE INDEX "contract_deliverable_reviews_contract_id_decision_idx" ON "contract"."contract_deliverable_reviews"("contract_id", "decision");
CREATE INDEX "contract_deliverable_reviews_version_id_idx" ON "contract"."contract_deliverable_reviews"("version_id");
CREATE UNIQUE INDEX "contract_claims_contract_id_claim_reference_key" ON "contract"."contract_claims"("contract_id", "claim_reference");
CREATE INDEX "contract_claims_contract_id_status_idx" ON "contract"."contract_claims"("contract_id", "status");
CREATE INDEX "contract_claim_responses_contract_id_decision_idx" ON "contract"."contract_claim_responses"("contract_id", "decision");
CREATE INDEX "contract_claim_responses_claim_id_idx" ON "contract"."contract_claim_responses"("claim_id");
CREATE UNIQUE INDEX "contract_extension_requests_contract_id_reference_key" ON "contract"."contract_extension_requests"("contract_id", "request_reference");
CREATE INDEX "contract_extension_requests_contract_id_status_idx" ON "contract"."contract_extension_requests"("contract_id", "status");
CREATE UNIQUE INDEX "contract_amendments_contract_id_reference_key" ON "contract"."contract_amendments"("contract_id", "amendment_reference");
CREATE INDEX "contract_amendments_contract_id_status_idx" ON "contract"."contract_amendments"("contract_id", "status");

ALTER TABLE "contract"."contract_activations" ADD CONSTRAINT "contract_activations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_activation_items" ADD CONSTRAINT "contract_activation_items_activation_id_fkey" FOREIGN KEY ("activation_id") REFERENCES "contract"."contract_activations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_activation_items" ADD CONSTRAINT "contract_activation_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_baselines" ADD CONSTRAINT "contract_baselines_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_obligations" ADD CONSTRAINT "contract_obligations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_evidence_requirements" ADD CONSTRAINT "contract_evidence_requirements_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_evidence_requirements" ADD CONSTRAINT "contract_evidence_requirements_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "contract"."contract_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_delivery_schedules" ADD CONSTRAINT "contract_delivery_schedules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_dispatch_notices" ADD CONSTRAINT "contract_dispatch_notices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_goods_receipts" ADD CONSTRAINT "contract_goods_receipts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_goods_receipt_lines" ADD CONSTRAINT "contract_goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "contract"."contract_goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_site_handovers" ADD CONSTRAINT "contract_site_handovers_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_works_progress_reports" ADD CONSTRAINT "contract_works_progress_reports_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_boq_measurements" ADD CONSTRAINT "contract_boq_measurements_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_interim_payment_certificates" ADD CONSTRAINT "contract_ipc_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_defects" ADD CONSTRAINT "contract_defects_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_service_levels" ADD CONSTRAINT "contract_service_levels_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_service_periods" ADD CONSTRAINT "contract_service_periods_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_service_reports" ADD CONSTRAINT "contract_service_reports_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_service_credits" ADD CONSTRAINT "contract_service_credits_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_consultancy_deliverables" ADD CONSTRAINT "contract_consultancy_deliverables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_deliverable_versions" ADD CONSTRAINT "contract_deliverable_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_deliverable_versions" ADD CONSTRAINT "contract_deliverable_versions_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "contract"."contract_consultancy_deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_deliverable_reviews" ADD CONSTRAINT "contract_deliverable_reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_deliverable_reviews" ADD CONSTRAINT "contract_deliverable_reviews_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract"."contract_deliverable_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_claims" ADD CONSTRAINT "contract_claims_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_claim_responses" ADD CONSTRAINT "contract_claim_responses_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_claim_responses" ADD CONSTRAINT "contract_claim_responses_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "contract"."contract_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_extension_requests" ADD CONSTRAINT "contract_extension_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
