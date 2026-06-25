ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'SIGNED';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'MOBILIZATION';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'AT_RISK';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'WARRANTY_DEFECTS';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'TERMINATION_REVIEW';
ALTER TYPE "contract"."ContractStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

CREATE TYPE "contract"."ContractLifecycleItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED', 'CLOSED');
CREATE TYPE "contract"."ContractRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "contract"."ContractTerminationStatus" AS ENUM ('DRAFT', 'NOTICE_ISSUED', 'CURE_PERIOD_ACTIVE', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'TERMINATED', 'SETTLEMENT_PENDING', 'DISPUTED', 'CLOSED');
CREATE TYPE "contract"."ContractTerminationType" AS ENUM ('SUPPLIER_DEFAULT', 'BUYER_DEFAULT', 'CONVENIENCE', 'MUTUAL', 'FORCE_MAJEURE', 'INSOLVENCY', 'FRAUD_CORRUPTION');

CREATE TABLE "contract"."contract_management_plans" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "contract_manager_id" UUID,
  "objectives" TEXT,
  "monitoring_plan" TEXT,
  "reporting_plan" TEXT,
  "communication_plan" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_management_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_mobilization_items" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "responsible_role" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "due_date" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "waived_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_mobilization_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_kpis" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "area" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "target" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "score" DECIMAL(5,2),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_kpis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_inspections" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "milestone_id" UUID,
  "inspection_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "result" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "inspected_at" TIMESTAMP(3),
  "inspector_user_id" UUID,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_risks" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "likelihood" INTEGER NOT NULL DEFAULT 1,
  "impact" INTEGER NOT NULL DEFAULT 1,
  "score" INTEGER NOT NULL DEFAULT 1,
  "level" "contract"."ContractRiskLevel" NOT NULL DEFAULT 'LOW',
  "responsible_user_id" UUID,
  "mitigation_action" TEXT,
  "due_date" TIMESTAMP(3),
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_risks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_variations" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "requested_by_org_id" UUID,
  "title" TEXT NOT NULL,
  "change_type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "affected_clause" TEXT,
  "cost_impact" DECIMAL(18,2),
  "time_impact_days" INTEGER,
  "technical_impact" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "decision" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_variations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_issues" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "raised_by_org_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "due_date" TIMESTAMP(3),
  "resolution" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_disputes" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "raised_by_org_id" UUID,
  "title" TEXT NOT NULL,
  "contract_clause" TEXT,
  "description" TEXT,
  "route" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "decision" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_terminations" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "termination_type" "contract"."ContractTerminationType" NOT NULL,
  "initiated_by_org_id" UUID,
  "reason" TEXT NOT NULL,
  "contract_clause" TEXT,
  "fault_party" TEXT,
  "status" "contract"."ContractTerminationStatus" NOT NULL DEFAULT 'DRAFT',
  "notice_date" TIMESTAMP(3),
  "cure_deadline" TIMESTAMP(3),
  "termination_effective_date" TIMESTAMP(3),
  "supplier_response" TEXT,
  "final_decision" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_terminations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."termination_notices" (
  "id" UUID NOT NULL,
  "termination_id" UUID NOT NULL,
  "notice_type" TEXT NOT NULL,
  "contract_clause" TEXT,
  "required_action" TEXT,
  "deadline" TIMESTAMP(3),
  "note" TEXT,
  "acknowledged_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "termination_notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."termination_evidence" (
  "id" UUID NOT NULL,
  "termination_id" UUID NOT NULL,
  "document_id" UUID,
  "evidence_type" TEXT NOT NULL,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "termination_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."termination_valuations" (
  "id" UUID NOT NULL,
  "termination_id" UUID NOT NULL,
  "accepted_value" DECIMAL(18,2),
  "rejected_value" DECIMAL(18,2),
  "advance_recovery" DECIMAL(18,2),
  "retention_held" DECIMAL(18,2),
  "liquidated_damages" DECIMAL(18,2),
  "cost_to_complete" DECIMAL(18,2),
  "performance_security_claim" DECIMAL(18,2),
  "final_amount_payable" DECIMAL(18,2),
  "final_amount_recoverable" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "termination_valuations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."termination_settlements" (
  "id" UUID NOT NULL,
  "termination_id" UUID NOT NULL,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "settlement_note" TEXT,
  "settled_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "termination_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."replacement_procurement_plans" (
  "id" UUID NOT NULL,
  "termination_id" UUID NOT NULL,
  "method" TEXT NOT NULL,
  "urgency_level" "contract"."ContractRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "remaining_scope" TEXT,
  "estimated_cost" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "replacement_procurement_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_closeouts" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "completion_certificate" BOOLEAN NOT NULL DEFAULT false,
  "final_account_approved" BOOLEAN NOT NULL DEFAULT false,
  "warranty_start_date" TIMESTAMP(3),
  "warranty_end_date" TIMESTAMP(3),
  "lessons_learned" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_closeouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."supplier_performance_records" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "supplier_org_id" UUID,
  "overall_score" DECIMAL(5,2),
  "time_score" DECIMAL(5,2),
  "quality_score" DECIMAL(5,2),
  "cost_score" DECIMAL(5,2),
  "compliance_score" DECIMAL(5,2),
  "termination_fault" TEXT,
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_performance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_management_plans_contract_id_key" ON "contract"."contract_management_plans"("contract_id");
CREATE INDEX "contract_management_plans_contract_manager_id_idx" ON "contract"."contract_management_plans"("contract_manager_id");
CREATE INDEX "contract_mobilization_items_contract_id_status_idx" ON "contract"."contract_mobilization_items"("contract_id", "status");
CREATE INDEX "contract_kpis_contract_id_status_idx" ON "contract"."contract_kpis"("contract_id", "status");
CREATE INDEX "contract_inspections_contract_id_result_idx" ON "contract"."contract_inspections"("contract_id", "result");
CREATE INDEX "contract_inspections_milestone_id_idx" ON "contract"."contract_inspections"("milestone_id");
CREATE INDEX "contract_risks_contract_id_status_idx" ON "contract"."contract_risks"("contract_id", "status");
CREATE INDEX "contract_risks_level_idx" ON "contract"."contract_risks"("level");
CREATE INDEX "contract_variations_contract_id_status_idx" ON "contract"."contract_variations"("contract_id", "status");
CREATE INDEX "contract_issues_contract_id_status_idx" ON "contract"."contract_issues"("contract_id", "status");
CREATE INDEX "contract_disputes_contract_id_status_idx" ON "contract"."contract_disputes"("contract_id", "status");
CREATE INDEX "contract_terminations_contract_id_status_idx" ON "contract"."contract_terminations"("contract_id", "status");
CREATE INDEX "termination_notices_termination_id_idx" ON "contract"."termination_notices"("termination_id");
CREATE INDEX "termination_evidence_termination_id_idx" ON "contract"."termination_evidence"("termination_id");
CREATE INDEX "termination_evidence_document_id_idx" ON "contract"."termination_evidence"("document_id");
CREATE UNIQUE INDEX "termination_valuations_termination_id_key" ON "contract"."termination_valuations"("termination_id");
CREATE UNIQUE INDEX "termination_settlements_termination_id_key" ON "contract"."termination_settlements"("termination_id");
CREATE UNIQUE INDEX "replacement_procurement_plans_termination_id_key" ON "contract"."replacement_procurement_plans"("termination_id");
CREATE UNIQUE INDEX "contract_closeouts_contract_id_key" ON "contract"."contract_closeouts"("contract_id");
CREATE INDEX "supplier_performance_records_buyer_org_id_idx" ON "contract"."supplier_performance_records"("buyer_org_id");
CREATE INDEX "supplier_performance_records_supplier_org_id_idx" ON "contract"."supplier_performance_records"("supplier_org_id");
CREATE INDEX "supplier_performance_records_contract_id_idx" ON "contract"."supplier_performance_records"("contract_id");

ALTER TABLE "contract"."contract_management_plans" ADD CONSTRAINT "contract_management_plans_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_management_plans" ADD CONSTRAINT "contract_management_plans_contract_manager_id_fkey" FOREIGN KEY ("contract_manager_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_mobilization_items" ADD CONSTRAINT "contract_mobilization_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_kpis" ADD CONSTRAINT "contract_kpis_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_inspections" ADD CONSTRAINT "contract_inspections_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_inspections" ADD CONSTRAINT "contract_inspections_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "contract"."contract_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_inspections" ADD CONSTRAINT "contract_inspections_inspector_user_id_fkey" FOREIGN KEY ("inspector_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_risks" ADD CONSTRAINT "contract_risks_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_risks" ADD CONSTRAINT "contract_risks_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_variations" ADD CONSTRAINT "contract_variations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_issues" ADD CONSTRAINT "contract_issues_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_disputes" ADD CONSTRAINT "contract_disputes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_terminations" ADD CONSTRAINT "contract_terminations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."termination_notices" ADD CONSTRAINT "termination_notices_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "contract"."contract_terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."termination_evidence" ADD CONSTRAINT "termination_evidence_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "contract"."contract_terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."termination_evidence" ADD CONSTRAINT "termination_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"."termination_valuations" ADD CONSTRAINT "termination_valuations_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "contract"."contract_terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."termination_settlements" ADD CONSTRAINT "termination_settlements_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "contract"."contract_terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."replacement_procurement_plans" ADD CONSTRAINT "replacement_procurement_plans_termination_id_fkey" FOREIGN KEY ("termination_id") REFERENCES "contract"."contract_terminations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_closeouts" ADD CONSTRAINT "contract_closeouts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract"."supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "contract"."contract_parties" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "role" "contract"."ContractPartyRole" NOT NULL,
  "organization_id" UUID,
  "display_name" TEXT NOT NULL,
  "contact_name" TEXT,
  "contact_email" TEXT,
  "signatory_name" TEXT,
  "signatory_title" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_clauses" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "clause_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "buyer_comment" TEXT,
  "supplier_comment" TEXT,
  "legal_comment" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_clauses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_negotiations" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "clause_id" UUID,
  "raised_by_role" TEXT NOT NULL,
  "raised_by_org_id" UUID,
  "subject" TEXT NOT NULL,
  "position" TEXT,
  "counter_offer" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "due_date" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_negotiations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_deliverables" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "milestone_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "submitted_by_org_id" UUID,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "due_date" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "acceptance_note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_acceptances" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "deliverable_id" UUID,
  "inspection_id" UUID,
  "certificate_no" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "accepted_value" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "accepted_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_payment_schedules" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "milestone_id" UUID,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "due_date" TIMESTAMP(3),
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_payment_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_payments" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "invoice_id" UUID,
  "schedule_id" UUID,
  "status" "financial"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "gross_amount" DECIMAL(18,2),
  "retention_amount" DECIMAL(18,2),
  "advance_recovery" DECIMAL(18,2),
  "liquidated_damages" DECIMAL(18,2),
  "tax_withholding" DECIMAL(18,2),
  "net_amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "reviewed_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "paid_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_warranties" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "defect_reference" TEXT,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "responsible_role" TEXT,
  "resolution" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_warranties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_required_documents" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "document_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "owner_role" TEXT NOT NULL,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "document_id" UUID,
  "due_date" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_required_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_workflow_approvals" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "step_key" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
  "actor_user_id" UUID,
  "decided_at" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_workflow_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."urgent_actions" (
  "id" UUID NOT NULL,
  "owner_org_id" UUID,
  "contract_id" UUID,
  "award_id" UUID,
  "notice_id" UUID,
  "action_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "required_action" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL DEFAULT 'Medium',
  "due_date" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "next_route" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "urgent_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."notifications" (
  "id" UUID NOT NULL,
  "owner_org_id" UUID,
  "user_id" UUID,
  "contract_id" UUID,
  "award_id" UUID,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNREAD',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_parties_contract_id_role_key" ON "contract"."contract_parties"("contract_id", "role");
CREATE INDEX "contract_parties_organization_id_idx" ON "contract"."contract_parties"("organization_id");
CREATE UNIQUE INDEX "contract_clauses_contract_id_clause_key_key" ON "contract"."contract_clauses"("contract_id", "clause_key");
CREATE INDEX "contract_clauses_contract_id_status_idx" ON "contract"."contract_clauses"("contract_id", "status");
CREATE INDEX "contract_negotiations_contract_id_status_idx" ON "contract"."contract_negotiations"("contract_id", "status");
CREATE INDEX "contract_negotiations_clause_id_idx" ON "contract"."contract_negotiations"("clause_id");
CREATE INDEX "contract_deliverables_contract_id_status_idx" ON "contract"."contract_deliverables"("contract_id", "status");
CREATE INDEX "contract_deliverables_milestone_id_idx" ON "contract"."contract_deliverables"("milestone_id");
CREATE INDEX "contract_acceptances_contract_id_status_idx" ON "contract"."contract_acceptances"("contract_id", "status");
CREATE INDEX "contract_acceptances_deliverable_id_idx" ON "contract"."contract_acceptances"("deliverable_id");
CREATE INDEX "contract_payment_schedules_contract_id_status_idx" ON "contract"."contract_payment_schedules"("contract_id", "status");
CREATE INDEX "contract_payment_schedules_due_date_idx" ON "contract"."contract_payment_schedules"("due_date");
CREATE INDEX "contract_payments_contract_id_status_idx" ON "contract"."contract_payments"("contract_id", "status");
CREATE INDEX "contract_payments_invoice_id_idx" ON "contract"."contract_payments"("invoice_id");
CREATE INDEX "contract_warranties_contract_id_status_idx" ON "contract"."contract_warranties"("contract_id", "status");
CREATE INDEX "contract_warranties_end_date_idx" ON "contract"."contract_warranties"("end_date");
CREATE UNIQUE INDEX "contract_required_documents_contract_id_document_type_key" ON "contract"."contract_required_documents"("contract_id", "document_type");
CREATE INDEX "contract_required_documents_contract_id_status_idx" ON "contract"."contract_required_documents"("contract_id", "status");
CREATE UNIQUE INDEX "contract_workflow_approvals_contract_id_step_key_key" ON "contract"."contract_workflow_approvals"("contract_id", "step_key");
CREATE INDEX "contract_workflow_approvals_contract_id_status_idx" ON "contract"."contract_workflow_approvals"("contract_id", "status");
CREATE UNIQUE INDEX "urgent_actions_owner_org_id_action_key_key" ON "contract"."urgent_actions"("owner_org_id", "action_key");
CREATE INDEX "urgent_actions_owner_org_id_status_idx" ON "contract"."urgent_actions"("owner_org_id", "status");
CREATE INDEX "urgent_actions_contract_id_idx" ON "contract"."urgent_actions"("contract_id");
CREATE INDEX "notifications_owner_org_id_status_idx" ON "contract"."notifications"("owner_org_id", "status");
CREATE INDEX "notifications_user_id_status_idx" ON "contract"."notifications"("user_id", "status");
CREATE INDEX "notifications_contract_id_idx" ON "contract"."notifications"("contract_id");

ALTER TABLE "contract"."contract_parties" ADD CONSTRAINT "contract_parties_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_clauses" ADD CONSTRAINT "contract_clauses_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_negotiations" ADD CONSTRAINT "contract_negotiations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_deliverables" ADD CONSTRAINT "contract_deliverables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_acceptances" ADD CONSTRAINT "contract_acceptances_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_payment_schedules" ADD CONSTRAINT "contract_payment_schedules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_payments" ADD CONSTRAINT "contract_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_warranties" ADD CONSTRAINT "contract_warranties_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_required_documents" ADD CONSTRAINT "contract_required_documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_workflow_approvals" ADD CONSTRAINT "contract_workflow_approvals_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."urgent_actions" ADD CONSTRAINT "urgent_actions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."notifications" ADD CONSTRAINT "notifications_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
