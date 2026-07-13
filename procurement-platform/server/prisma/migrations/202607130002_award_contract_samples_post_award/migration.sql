CREATE TABLE "contract"."sample_receipts" (
  "id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "sample_reference" TEXT,
  "received_quantity" DECIMAL(18,4),
  "condition_at_receipt" TEXT,
  "packaging_condition" TEXT,
  "delivery_representative" TEXT,
  "receiving_officer_id" UUID,
  "storage_location" TEXT,
  "missing_components" TEXT,
  "visible_damage" TEXT,
  "remarks" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sample_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."sample_custody_logs" (
  "id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "from_custodian_id" UUID,
  "to_custodian_id" UUID,
  "previous_location" TEXT,
  "new_location" TEXT,
  "transfer_purpose" TEXT NOT NULL,
  "condition_before" TEXT,
  "condition_after" TEXT,
  "authorized_by_id" UUID,
  "remarks" TEXT,
  "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sample_custody_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."sample_verifications" (
  "id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "result" TEXT NOT NULL,
  "quantity_accepted" BOOLEAN NOT NULL DEFAULT false,
  "certificates_attached" BOOLEAN NOT NULL DEFAULT false,
  "packaging_accepted" BOOLEAN NOT NULL DEFAULT false,
  "matches_bid" BOOLEAN NOT NULL DEFAULT false,
  "complete_undamaged" BOOLEAN NOT NULL DEFAULT false,
  "clarification_required" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "verified_by_user_id" UUID,
  "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sample_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."sample_evaluations" (
  "id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "criterion" TEXT NOT NULL,
  "score" DECIMAL(8,2),
  "maximum_score" DECIMAL(8,2),
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "decision" TEXT NOT NULL DEFAULT 'UNDER_EVALUATION',
  "comments" TEXT,
  "evaluator_user_id" UUID,
  "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sample_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."sample_tests" (
  "id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "test_name" TEXT NOT NULL,
  "testing_institution" TEXT,
  "testing_officer" TEXT,
  "testing_method" TEXT,
  "testing_standard" TEXT,
  "expected_result" TEXT,
  "actual_result" TEXT,
  "result" TEXT NOT NULL DEFAULT 'PENDING',
  "test_cost" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "responsible_party" TEXT,
  "report_document_id" UUID,
  "tested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sample_tests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."sample_dispositions" (
  "id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "disposition_type" TEXT NOT NULL,
  "reason" TEXT,
  "authorized_by_user_id" UUID,
  "supplier_notified_at" TIMESTAMP(3),
  "collection_deadline" TIMESTAMP(3),
  "collection_representative" TEXT,
  "return_condition" TEXT,
  "disposal_method" TEXT,
  "witnesses" TEXT,
  "acknowledgement_document_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "completed_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sample_dispositions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_reference_samples" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "bid_sample_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "reference_no" TEXT NOT NULL,
  "sample_name" TEXT NOT NULL,
  "storage_location" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RETAINED',
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_reference_samples_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_commencements" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "notice_date" TIMESTAMP(3),
  "start_date" TIMESTAMP(3),
  "effective_date" TIMESTAMP(3),
  "completion_date" TIMESTAMP(3),
  "delivery_location" TEXT,
  "buyer_contract_manager" TEXT,
  "supplier_contract_manager" TEXT,
  "initial_meeting_date" TIMESTAMP(3),
  "approved_work_plan" TEXT,
  "approved_delivery_schedule" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_commencements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_non_conformances" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "related_record_id" UUID,
  "contract_clause" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MINOR',
  "responsible_supplier_officer" TEXT,
  "corrective_action" TEXT,
  "corrective_action_deadline" TIMESTAMP(3),
  "verification_result" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "identified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_non_conformances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_securities" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "security_type" TEXT NOT NULL,
  "issuing_institution" TEXT,
  "reference_number" TEXT,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "issue_date" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3),
  "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
  "claim_status" TEXT NOT NULL DEFAULT 'NONE',
  "released_at" TIMESTAMP(3),
  "document_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_securities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_penalties" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "invoice_id" UUID,
  "penalty_type" TEXT NOT NULL,
  "contract_clause" TEXT,
  "basis" TEXT,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approved_by_user_id" UUID,
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_penalties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_change_requests" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "change_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT,
  "raised_by_org_id" UUID,
  "technical_review" TEXT,
  "financial_review" TEXT,
  "budget_check" TEXT,
  "legal_review" TEXT,
  "supplier_response" TEXT,
  "amendment_version_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'RAISED',
  "approved_at" TIMESTAMP(3),
  "signed_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sample_receipts_bid_sample_id_key" ON "contract"."sample_receipts"("bid_sample_id");
CREATE UNIQUE INDEX "contract_reference_samples_contract_id_bid_sample_id_key" ON "contract"."contract_reference_samples"("contract_id", "bid_sample_id");
CREATE UNIQUE INDEX "contract_commencements_contract_id_key" ON "contract"."contract_commencements"("contract_id");

CREATE INDEX "sample_receipts_tender_id_idx" ON "contract"."sample_receipts"("tender_id");
CREATE INDEX "sample_receipts_bid_id_idx" ON "contract"."sample_receipts"("bid_id");
CREATE INDEX "sample_receipts_buyer_org_id_idx" ON "contract"."sample_receipts"("buyer_org_id");
CREATE INDEX "sample_receipts_supplier_org_id_idx" ON "contract"."sample_receipts"("supplier_org_id");
CREATE INDEX "sample_custody_logs_bid_sample_id_idx" ON "contract"."sample_custody_logs"("bid_sample_id");
CREATE INDEX "sample_custody_logs_tender_id_idx" ON "contract"."sample_custody_logs"("tender_id");
CREATE INDEX "sample_custody_logs_buyer_org_id_idx" ON "contract"."sample_custody_logs"("buyer_org_id");
CREATE INDEX "sample_verifications_bid_sample_id_idx" ON "contract"."sample_verifications"("bid_sample_id");
CREATE INDEX "sample_verifications_tender_id_idx" ON "contract"."sample_verifications"("tender_id");
CREATE INDEX "sample_verifications_buyer_org_id_idx" ON "contract"."sample_verifications"("buyer_org_id");
CREATE INDEX "sample_verifications_result_idx" ON "contract"."sample_verifications"("result");
CREATE INDEX "sample_evaluations_bid_sample_id_idx" ON "contract"."sample_evaluations"("bid_sample_id");
CREATE INDEX "sample_evaluations_tender_id_idx" ON "contract"."sample_evaluations"("tender_id");
CREATE INDEX "sample_evaluations_buyer_org_id_idx" ON "contract"."sample_evaluations"("buyer_org_id");
CREATE INDEX "sample_evaluations_decision_idx" ON "contract"."sample_evaluations"("decision");
CREATE INDEX "sample_tests_bid_sample_id_idx" ON "contract"."sample_tests"("bid_sample_id");
CREATE INDEX "sample_tests_tender_id_idx" ON "contract"."sample_tests"("tender_id");
CREATE INDEX "sample_tests_buyer_org_id_idx" ON "contract"."sample_tests"("buyer_org_id");
CREATE INDEX "sample_dispositions_bid_sample_id_idx" ON "contract"."sample_dispositions"("bid_sample_id");
CREATE INDEX "sample_dispositions_tender_id_idx" ON "contract"."sample_dispositions"("tender_id");
CREATE INDEX "sample_dispositions_buyer_org_id_idx" ON "contract"."sample_dispositions"("buyer_org_id");
CREATE INDEX "sample_dispositions_status_idx" ON "contract"."sample_dispositions"("status");
CREATE INDEX "contract_reference_samples_contract_id_idx" ON "contract"."contract_reference_samples"("contract_id");
CREATE INDEX "contract_reference_samples_bid_sample_id_idx" ON "contract"."contract_reference_samples"("bid_sample_id");
CREATE INDEX "contract_reference_samples_tender_id_idx" ON "contract"."contract_reference_samples"("tender_id");
CREATE INDEX "contract_commencements_status_idx" ON "contract"."contract_commencements"("status");
CREATE INDEX "contract_non_conformances_contract_id_status_idx" ON "contract"."contract_non_conformances"("contract_id", "status");
CREATE INDEX "contract_non_conformances_severity_idx" ON "contract"."contract_non_conformances"("severity");
CREATE INDEX "contract_securities_contract_id_verification_status_idx" ON "contract"."contract_securities"("contract_id", "verification_status");
CREATE INDEX "contract_securities_expiry_date_idx" ON "contract"."contract_securities"("expiry_date");
CREATE INDEX "contract_penalties_contract_id_status_idx" ON "contract"."contract_penalties"("contract_id", "status");
CREATE INDEX "contract_penalties_invoice_id_idx" ON "contract"."contract_penalties"("invoice_id");
CREATE INDEX "contract_change_requests_contract_id_status_idx" ON "contract"."contract_change_requests"("contract_id", "status");
CREATE INDEX "contract_change_requests_change_type_idx" ON "contract"."contract_change_requests"("change_type");
