CREATE TABLE "evaluation"."award_approval_routes" (
  "id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "route_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "current_step_order" INTEGER NOT NULL DEFAULT 1,
  "required_quorum" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "award_approval_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."award_approval_steps" (
  "id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "step_order" INTEGER NOT NULL,
  "step_key" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "actor_user_id" UUID,
  "status" "evaluation"."ApprovalStatus" NOT NULL DEFAULT 'WAITING',
  "due_date" TIMESTAMP(3),
  "decided_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "award_approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."award_tie_breakers" (
  "id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "tender_id" UUID,
  "trigger_reason" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "criteria" JSONB NOT NULL DEFAULT '[]',
  "outcome_bid_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "decided_by_user_id" UUID,
  "decided_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "award_tie_breakers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."delivery_feasibility_checks" (
  "id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "tender_id" UUID,
  "bid_id" UUID,
  "supplier_org_id" UUID,
  "delivery_capacity" TEXT,
  "site_readiness" TEXT,
  "resource_plan" TEXT,
  "risk_rating" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewer_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_feasibility_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."standstill_periods" (
  "id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "notice_id" UUID,
  "buyer_org_id" UUID,
  "supplier_org_id" UUID,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "days" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "waived" BOOLEAN NOT NULL DEFAULT false,
  "waiver_reason" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "standstill_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."award_notifications" (
  "id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "notice_id" UUID,
  "recipient_org_id" UUID,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "notification_type" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sent_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "award_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."goods_inspections" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "milestone_id" UUID,
  "deliverable_id" UUID,
  "inspection_no" TEXT NOT NULL,
  "goods_description" TEXT NOT NULL,
  "quantity_ordered" DECIMAL(18,4),
  "quantity_received" DECIMAL(18,4),
  "quantity_accepted" DECIMAL(18,4),
  "quantity_rejected" DECIMAL(18,4),
  "unit" TEXT,
  "location" TEXT,
  "result" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "inspected_by_user_id" UUID,
  "inspected_at" TIMESTAMP(3),
  "defects" JSONB NOT NULL DEFAULT '[]',
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goods_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."performance_scores" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "supplier_org_id" UUID,
  "score_type" TEXT NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  "weight" DECIMAL(5,2),
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "evaluator_user_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial"."budget_commitments" (
  "id" UUID NOT NULL,
  "recommendation_id" UUID,
  "tender_id" UUID,
  "contract_id" UUID,
  "buyer_org_id" UUID NOT NULL,
  "commitment_no" TEXT NOT NULL,
  "budget_code" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "reserved_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "approved_by_user_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "budget_commitments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial"."three_way_match_results" (
  "id" UUID NOT NULL,
  "contract_id" UUID,
  "invoice_id" UUID NOT NULL,
  "purchase_order_id" UUID,
  "acceptance_id" UUID,
  "status" "financial"."InvoiceStatus" NOT NULL DEFAULT 'REVIEW',
  "po_matched" BOOLEAN NOT NULL DEFAULT false,
  "receipt_matched" BOOLEAN NOT NULL DEFAULT false,
  "invoice_matched" BOOLEAN NOT NULL DEFAULT false,
  "variance_amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "reviewer_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "three_way_match_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial"."payment_approvals" (
  "id" UUID NOT NULL,
  "contract_id" UUID,
  "invoice_id" UUID,
  "payment_id" UUID,
  "step_key" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" "financial"."InvoiceStatus" NOT NULL DEFAULT 'REVIEW',
  "amount_approved" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "actor_user_id" UUID,
  "decided_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial"."payment_confirmations" (
  "id" UUID NOT NULL,
  "contract_id" UUID,
  "invoice_id" UUID,
  "payment_id" UUID,
  "confirmation_reference" TEXT NOT NULL,
  "paid_amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "paid_at" TIMESTAMP(3) NOT NULL,
  "evidence_document_id" UUID,
  "confirmed_by_user_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."supplier_risk_profiles" (
  "id" UUID NOT NULL,
  "supplier_org_id" UUID NOT NULL,
  "risk_level" "organization"."RiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "risk_score" INTEGER NOT NULL DEFAULT 50,
  "trust_tier" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "active_alerts" INTEGER NOT NULL DEFAULT 0,
  "open_violations" INTEGER NOT NULL DEFAULT 0,
  "last_reviewed_at" TIMESTAMP(3),
  "reviewer_user_id" UUID,
  "summary" TEXT,
  "drivers" JSONB NOT NULL DEFAULT '[]',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_risk_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."risk_forecasts" (
  "id" UUID NOT NULL,
  "supplier_org_id" UUID,
  "tender_id" UUID,
  "contract_id" UUID,
  "forecast_type" TEXT NOT NULL,
  "horizon_days" INTEGER NOT NULL DEFAULT 30,
  "probability" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "impact_level" "organization"."RiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "drivers" JSONB NOT NULL DEFAULT '[]',
  "recommendation" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."collusion_alerts" (
  "id" UUID NOT NULL,
  "tender_id" UUID,
  "bid_id" UUID,
  "supplier_org_id" UUID,
  "alert_type" TEXT NOT NULL,
  "severity" "compliance"."AuditSeverity" NOT NULL DEFAULT 'WARNING',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "confidence" DECIMAL(5,2),
  "signal_summary" TEXT,
  "assigned_user_id" UUID,
  "resolved_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collusion_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."compliance_reviews" (
  "id" UUID NOT NULL,
  "owner_org_id" UUID,
  "entity_type" TEXT NOT NULL,
  "entity_ref" TEXT,
  "review_type" TEXT NOT NULL,
  "status" "compliance"."ComplianceCaseStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "compliance"."AuditSeverity" NOT NULL DEFAULT 'WARNING',
  "assigned_user_id" UUID,
  "findings" TEXT,
  "decision" TEXT,
  "due_date" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compliance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."violation_cases" (
  "id" UUID NOT NULL,
  "review_id" UUID,
  "owner_org_id" UUID,
  "supplier_org_id" UUID,
  "title" TEXT NOT NULL,
  "violation_type" TEXT NOT NULL,
  "severity" "compliance"."AuditSeverity" NOT NULL DEFAULT 'WARNING',
  "status" "compliance"."ComplianceCaseStatus" NOT NULL DEFAULT 'OPEN',
  "statement" TEXT,
  "assigned_user_id" UUID,
  "decision" TEXT,
  "decided_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "violation_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."violation_evidence" (
  "id" UUID NOT NULL,
  "violation_id" UUID NOT NULL,
  "document_id" UUID,
  "evidence_type" TEXT NOT NULL,
  "description" TEXT,
  "submitted_by_user_id" UUID,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "violation_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."enforcement_records" (
  "id" UUID NOT NULL,
  "violation_id" UUID,
  "supplier_org_id" UUID,
  "enforcement_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "severity" "compliance"."AuditSeverity" NOT NULL DEFAULT 'WARNING',
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "action_summary" TEXT,
  "issued_by_user_id" UUID,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "enforcement_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance"."appeal_records" (
  "id" UUID NOT NULL,
  "enforcement_id" UUID,
  "violation_id" UUID,
  "appellant_org_id" UUID,
  "appeal_grounds" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "reviewer_user_id" UUID,
  "decision" TEXT,
  "decided_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appeal_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "award_approval_routes_recommendation_id_route_key_key" ON "evaluation"."award_approval_routes"("recommendation_id", "route_key");
CREATE INDEX "award_approval_routes_recommendation_id_status_idx" ON "evaluation"."award_approval_routes"("recommendation_id", "status");
CREATE UNIQUE INDEX "award_approval_steps_route_id_step_key_key" ON "evaluation"."award_approval_steps"("route_id", "step_key");
CREATE INDEX "award_approval_steps_recommendation_id_status_idx" ON "evaluation"."award_approval_steps"("recommendation_id", "status");
CREATE INDEX "award_approval_steps_actor_user_id_idx" ON "evaluation"."award_approval_steps"("actor_user_id");
CREATE INDEX "award_tie_breakers_recommendation_id_status_idx" ON "evaluation"."award_tie_breakers"("recommendation_id", "status");
CREATE INDEX "award_tie_breakers_tender_id_idx" ON "evaluation"."award_tie_breakers"("tender_id");
CREATE INDEX "delivery_feasibility_checks_recommendation_id_status_idx" ON "evaluation"."delivery_feasibility_checks"("recommendation_id", "status");
CREATE INDEX "delivery_feasibility_checks_supplier_org_id_idx" ON "evaluation"."delivery_feasibility_checks"("supplier_org_id");
CREATE INDEX "standstill_periods_recommendation_id_status_idx" ON "contract"."standstill_periods"("recommendation_id", "status");
CREATE INDEX "standstill_periods_buyer_org_id_status_idx" ON "contract"."standstill_periods"("buyer_org_id", "status");
CREATE INDEX "award_notifications_recommendation_id_status_idx" ON "contract"."award_notifications"("recommendation_id", "status");
CREATE INDEX "award_notifications_recipient_org_id_status_idx" ON "contract"."award_notifications"("recipient_org_id", "status");
CREATE UNIQUE INDEX "goods_inspections_contract_id_inspection_no_key" ON "contract"."goods_inspections"("contract_id", "inspection_no");
CREATE INDEX "goods_inspections_contract_id_result_idx" ON "contract"."goods_inspections"("contract_id", "result");
CREATE INDEX "goods_inspections_milestone_id_idx" ON "contract"."goods_inspections"("milestone_id");
CREATE INDEX "performance_scores_contract_id_score_type_idx" ON "contract"."performance_scores"("contract_id", "score_type");
CREATE INDEX "performance_scores_supplier_org_id_idx" ON "contract"."performance_scores"("supplier_org_id");
CREATE UNIQUE INDEX "budget_commitments_commitment_no_key" ON "financial"."budget_commitments"("commitment_no");
CREATE INDEX "budget_commitments_buyer_org_id_status_idx" ON "financial"."budget_commitments"("buyer_org_id", "status");
CREATE INDEX "budget_commitments_contract_id_idx" ON "financial"."budget_commitments"("contract_id");
CREATE INDEX "budget_commitments_recommendation_id_idx" ON "financial"."budget_commitments"("recommendation_id");
CREATE UNIQUE INDEX "three_way_match_results_invoice_id_key" ON "financial"."three_way_match_results"("invoice_id");
CREATE INDEX "three_way_match_results_contract_id_status_idx" ON "financial"."three_way_match_results"("contract_id", "status");
CREATE INDEX "payment_approvals_contract_id_status_idx" ON "financial"."payment_approvals"("contract_id", "status");
CREATE INDEX "payment_approvals_invoice_id_status_idx" ON "financial"."payment_approvals"("invoice_id", "status");
CREATE UNIQUE INDEX "payment_confirmations_confirmation_reference_key" ON "financial"."payment_confirmations"("confirmation_reference");
CREATE INDEX "payment_confirmations_contract_id_idx" ON "financial"."payment_confirmations"("contract_id");
CREATE INDEX "payment_confirmations_invoice_id_idx" ON "financial"."payment_confirmations"("invoice_id");
CREATE UNIQUE INDEX "supplier_risk_profiles_supplier_org_id_key" ON "compliance"."supplier_risk_profiles"("supplier_org_id");
CREATE INDEX "supplier_risk_profiles_risk_level_risk_score_idx" ON "compliance"."supplier_risk_profiles"("risk_level", "risk_score");
CREATE INDEX "risk_forecasts_supplier_org_id_status_idx" ON "compliance"."risk_forecasts"("supplier_org_id", "status");
CREATE INDEX "risk_forecasts_contract_id_status_idx" ON "compliance"."risk_forecasts"("contract_id", "status");
CREATE INDEX "collusion_alerts_tender_id_status_idx" ON "compliance"."collusion_alerts"("tender_id", "status");
CREATE INDEX "collusion_alerts_supplier_org_id_status_idx" ON "compliance"."collusion_alerts"("supplier_org_id", "status");
CREATE INDEX "compliance_reviews_owner_org_id_status_idx" ON "compliance"."compliance_reviews"("owner_org_id", "status");
CREATE INDEX "compliance_reviews_entity_type_entity_ref_idx" ON "compliance"."compliance_reviews"("entity_type", "entity_ref");
CREATE INDEX "violation_cases_supplier_org_id_status_idx" ON "compliance"."violation_cases"("supplier_org_id", "status");
CREATE INDEX "violation_cases_review_id_idx" ON "compliance"."violation_cases"("review_id");
CREATE INDEX "violation_evidence_violation_id_idx" ON "compliance"."violation_evidence"("violation_id");
CREATE INDEX "violation_evidence_document_id_idx" ON "compliance"."violation_evidence"("document_id");
CREATE INDEX "enforcement_records_supplier_org_id_status_idx" ON "compliance"."enforcement_records"("supplier_org_id", "status");
CREATE INDEX "enforcement_records_violation_id_idx" ON "compliance"."enforcement_records"("violation_id");
CREATE INDEX "appeal_records_appellant_org_id_status_idx" ON "compliance"."appeal_records"("appellant_org_id", "status");
CREATE INDEX "appeal_records_enforcement_id_idx" ON "compliance"."appeal_records"("enforcement_id");
