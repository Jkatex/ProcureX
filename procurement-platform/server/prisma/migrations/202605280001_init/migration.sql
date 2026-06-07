-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "bidding";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "communication";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "compliance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "contract";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "documents";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "evaluation";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "financial";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "integration";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "intelligence";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "organization";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "procurement";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "records";

-- CreateEnum
CREATE TYPE "identity"."AccountType" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "identity"."VerificationStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "identity"."SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "organization"."OrganizationKind" AS ENUM ('COMPANY', 'PLATFORM');

-- CreateEnum
CREATE TYPE "organization"."OrganizationCapabilityName" AS ENUM ('BUYER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "organization"."MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "organization"."TrustTier" AS ENUM ('UNVERIFIED', 'VERIFIED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "organization"."RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "procurement"."TenderType" AS ENUM ('GOODS', 'WORKS', 'SERVICE', 'CONSULTANCY');

-- CreateEnum
CREATE TYPE "procurement"."TenderStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'OPEN', 'CLOSED', 'EVALUATION', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "procurement"."ProcurementMethod" AS ENUM ('OPEN_TENDER', 'INVITED_TENDER');

-- CreateEnum
CREATE TYPE "procurement"."Visibility" AS ENUM ('PRIVATE', 'INVITED', 'PUBLIC_MARKETPLACE');

-- CreateEnum
CREATE TYPE "procurement"."ContractType" AS ENUM ('UNIT_PRICE', 'LUMP_SUM', 'FRAMEWORK', 'TIME_AND_MATERIALS', 'OTHER');

-- CreateEnum
CREATE TYPE "bidding"."BidStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'WITHDRAWN', 'OPENED', 'UNDER_EVALUATION', 'DISQUALIFIED', 'AWARDED', 'LOST');

-- CreateEnum
CREATE TYPE "bidding"."EnvelopeType" AS ENUM ('TECHNICAL', 'FINANCIAL', 'COMBINED');

-- CreateEnum
CREATE TYPE "documents"."DocumentReviewStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "evaluation"."EvaluationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'LOCKED', 'COMPLETED', 'RETURNED');

-- CreateEnum
CREATE TYPE "evaluation"."EvaluationStage" AS ENUM ('OPENING', 'CONFLICT', 'PRELIMINARY', 'ELIGIBILITY', 'TECHNICAL', 'FINANCIAL', 'CLARIFICATIONS', 'COMPARISON', 'REPORT', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "evaluation"."WorkflowAssignmentType" AS ENUM ('EVALUATOR', 'APPROVER', 'AUDITOR', 'OBSERVER');

-- CreateEnum
CREATE TYPE "evaluation"."ApprovalStatus" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "evaluation"."RecommendationStatus" AS ENUM ('DRAFT', 'RECOMMENDED', 'APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "contract"."ContractStatus" AS ENUM ('DRAFT', 'NEGOTIATION', 'SIGNATURE_PENDING', 'ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "contract"."SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "financial"."InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MATCHED', 'REVIEW', 'BLOCKED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "compliance"."AuditSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "compliance"."ComplianceCaseStatus" AS ENUM ('OPEN', 'INVESTIGATION', 'FALSE_POSITIVE', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "compliance"."AdminActionType" AS ENUM ('REVIEW', 'APPROVE', 'RETURN', 'HOLD', 'FLAG', 'EXPORT');

-- CreateEnum
CREATE TYPE "communication"."CommunicationKind" AS ENUM ('MESSAGE', 'CLARIFICATION', 'NOTIFICATION', 'ALERT');

-- CreateEnum
CREATE TYPE "communication"."CommunicationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "communication"."CommunicationStatus" AS ENUM ('UNREAD', 'READ', 'REPLIED', 'PENDING_RESPONSE', 'RESOLVED', 'ARCHIVED', 'DELETED', 'ACTION_REQUIRED', 'COMPLETED');

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "account_type" "identity"."AccountType" NOT NULL DEFAULT 'USER',
    "verification_status" "identity"."VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'password',
    "provider_user_id" TEXT,
    "account_type" "identity"."AccountType" NOT NULL DEFAULT 'USER',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "token_hash" TEXT NOT NULL,
    "status" "identity"."SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."mfa_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "secret_ref" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."verification_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "status" "identity"."VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "registry_source" TEXT,
    "registry_number" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."verification_documents" (
    "id" UUID NOT NULL,
    "verification_profile_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "status" "documents"."DocumentReviewStatus" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "organization"."OrganizationKind" NOT NULL DEFAULT 'COMPANY',
    "tax_id" TEXT,
    "country" TEXT NOT NULL DEFAULT 'TZ',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "organization"."MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."organization_capabilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capability" "organization"."OrganizationCapabilityName" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."organization_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "summary" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."buyer_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "procuring_type" TEXT,
    "budget_code" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."supplier_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trust_tier" "organization"."TrustTier" NOT NULL DEFAULT 'UNVERIFIED',
    "risk_level" "organization"."RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "bid_limit" DECIMAL(18,2),
    "categories" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."tenders" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "buyer_org_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "procurement"."TenderType" NOT NULL,
    "status" "procurement"."TenderStatus" NOT NULL DEFAULT 'DRAFT',
    "method" "procurement"."ProcurementMethod" NOT NULL DEFAULT 'OPEN_TENDER',
    "visibility" "procurement"."Visibility" NOT NULL DEFAULT 'PUBLIC_MARKETPLACE',
    "budget" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "location" TEXT,
    "contract_type" "procurement"."ContractType",
    "closing_date" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "requirements" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."tender_categories" (
    "id" UUID NOT NULL,
    "tender_id" UUID,
    "type" "procurement"."TenderType",
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."tender_documents" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."tender_requirements" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "section" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."tender_milestones" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."tender_commercial_items" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "item_no" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "rate" DECIMAL(18,2),
    "total" DECIMAL(18,2),
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "tender_commercial_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding"."bids" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "buyer_org_id" UUID NOT NULL,
    "supplier_org_id" UUID NOT NULL,
    "submitted_by_user_id" UUID,
    "reference" TEXT NOT NULL,
    "status" "bidding"."BidStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "total_amount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding"."bid_versions" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "envelope" "bidding"."EnvelopeType" NOT NULL DEFAULT 'COMBINED',
    "sealed_hash" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding"."bid_documents" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "envelope" "bidding"."EnvelopeType" NOT NULL DEFAULT 'COMBINED',
    "review_status" "documents"."DocumentReviewStatus" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding"."bid_responses" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "requirement_key" TEXT NOT NULL,
    "response" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding"."bid_receipts" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "receipt_ref" TEXT NOT NULL,
    "receipt_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."evaluation_workspaces" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "buyer_org_id" UUID NOT NULL,
    "status" "evaluation"."EvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "current_stage" "evaluation"."EvaluationStage",
    "progress" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."workflow_assignments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assignment" "evaluation"."WorkflowAssignmentType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."evaluation_criteria" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "stage" "evaluation"."EvaluationStage" NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL(8,2),
    "max_score" DECIMAL(8,2),
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."evaluation_scores" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "criterion_id" UUID,
    "bid_id" UUID NOT NULL,
    "evaluator_user_id" UUID,
    "score" DECIMAL(8,2),
    "comment" TEXT,
    "locked_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."award_recommendations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "bid_id" UUID,
    "supplier_org_id" UUID,
    "status" "evaluation"."RecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."approval_steps" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "assignment" "evaluation"."WorkflowAssignmentType" NOT NULL DEFAULT 'APPROVER',
    "status" "evaluation"."ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "action" TEXT,
    "decided_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract"."contracts" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "tender_id" UUID,
    "award_id" UUID,
    "buyer_org_id" UUID NOT NULL,
    "supplier_org_id" UUID,
    "title" TEXT NOT NULL,
    "status" "contract"."ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract"."contract_versions" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "document_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial"."purchase_orders" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "contract_id" UUID,
    "buyer_org_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial"."invoices" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "purchase_order_id" UUID,
    "contract_id" UUID,
    "buyer_org_id" UUID NOT NULL,
    "supplier_org_id" UUID,
    "status" "financial"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."document_objects" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "uploaded_by_user_id" UUID,
    "name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "checksum" TEXT,
    "encryption_key_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."audit_events" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "actor_user_id" UUID,
    "event" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_ref" TEXT,
    "severity" "compliance"."AuditSeverity" NOT NULL DEFAULT 'INFO',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."compliance_cases" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "title" TEXT NOT NULL,
    "severity" "compliance"."AuditSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "compliance"."ComplianceCaseStatus" NOT NULL DEFAULT 'OPEN',
    "owner" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."risk_signals" (
    "id" UUID NOT NULL,
    "tender_id" UUID,
    "supplier_org_id" UUID,
    "risk_level" "organization"."RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "score" INTEGER,
    "driver" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."admin_actions" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "owner_org_id" UUID,
    "action_type" "compliance"."AdminActionType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_ref" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication"."communication_items" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "sender_org_id" UUID,
    "recipient_org_id" UUID,
    "tender_id" UUID,
    "kind" "communication"."CommunicationKind" NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'inbox',
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "communication"."CommunicationStatus" NOT NULL DEFAULT 'UNREAD',
    "priority" "communication"."CommunicationPriority" NOT NULL DEFAULT 'NORMAL',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "action_required" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication"."communication_attachments" (
    "id" UUID NOT NULL,
    "communication_item_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records"."record_entries" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence"."market_snapshots" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence"."price_benchmarks" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "tender_type" "procurement"."TenderType",
    "category" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence"."supplier_match_signals" (
    "id" UUID NOT NULL,
    "tender_id" UUID,
    "supplier_org_id" UUID,
    "score" INTEGER,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_match_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence"."module_registry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "version" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."external_systems" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID,
    "name" TEXT NOT NULL,
    "system_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Configured',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."integration_sync_runs" (
    "id" UUID NOT NULL,
    "external_system_id" UUID NOT NULL,
    "owner_org_id" UUID,
    "status" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."integration_events" (
    "id" UUID NOT NULL,
    "sync_run_id" UUID,
    "owner_org_id" UUID,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "identity"."users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "identity"."accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_user_id_key" ON "identity"."accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_status_idx" ON "identity"."sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "sessions_organization_id_idx" ON "identity"."sessions"("organization_id");

-- CreateIndex
CREATE INDEX "mfa_factors_user_id_idx" ON "identity"."mfa_factors"("user_id");

-- CreateIndex
CREATE INDEX "verification_profiles_user_id_idx" ON "identity"."verification_profiles"("user_id");

-- CreateIndex
CREATE INDEX "verification_profiles_organization_id_status_idx" ON "identity"."verification_profiles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "verification_documents_verification_profile_id_idx" ON "identity"."verification_documents"("verification_profile_id");

-- CreateIndex
CREATE INDEX "verification_documents_document_id_idx" ON "identity"."verification_documents"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organization"."organizations"("name");

-- CreateIndex
CREATE INDEX "organizations_kind_idx" ON "organization"."organizations"("kind");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization"."organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization"."organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_capabilities_capability_enabled_idx" ON "organization"."organization_capabilities"("capability", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "organization_capabilities_organization_id_capability_key" ON "organization"."organization_capabilities"("organization_id", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "organization_profiles_organization_id_key" ON "organization"."organization_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_profiles_organization_id_key" ON "organization"."buyer_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profiles_organization_id_key" ON "organization"."supplier_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_reference_key" ON "procurement"."tenders"("reference");

-- CreateIndex
CREATE INDEX "tenders_buyer_org_id_status_idx" ON "procurement"."tenders"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "tenders_status_type_closing_date_idx" ON "procurement"."tenders"("status", "type", "closing_date");

-- CreateIndex
CREATE UNIQUE INDEX "tender_categories_tender_id_name_key" ON "procurement"."tender_categories"("tender_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tender_categories_type_name_key" ON "procurement"."tender_categories"("type", "name");

-- CreateIndex
CREATE INDEX "tender_documents_document_id_idx" ON "procurement"."tender_documents"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_documents_tender_id_document_id_key" ON "procurement"."tender_documents"("tender_id", "document_id");

-- CreateIndex
CREATE INDEX "tender_requirements_tender_id_section_idx" ON "procurement"."tender_requirements"("tender_id", "section");

-- CreateIndex
CREATE INDEX "tender_milestones_tender_id_due_date_idx" ON "procurement"."tender_milestones"("tender_id", "due_date");

-- CreateIndex
CREATE INDEX "tender_commercial_items_tender_id_idx" ON "procurement"."tender_commercial_items"("tender_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_reference_key" ON "bidding"."bids"("reference");

-- CreateIndex
CREATE INDEX "bids_tender_id_status_idx" ON "bidding"."bids"("tender_id", "status");

-- CreateIndex
CREATE INDEX "bids_buyer_org_id_status_idx" ON "bidding"."bids"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "bids_supplier_org_id_status_idx" ON "bidding"."bids"("supplier_org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bid_versions_bid_id_version_no_envelope_key" ON "bidding"."bid_versions"("bid_id", "version_no", "envelope");

-- CreateIndex
CREATE INDEX "bid_documents_bid_id_envelope_idx" ON "bidding"."bid_documents"("bid_id", "envelope");

-- CreateIndex
CREATE UNIQUE INDEX "bid_documents_bid_id_document_id_key" ON "bidding"."bid_documents"("bid_id", "document_id");

-- CreateIndex
CREATE INDEX "bid_responses_bid_id_idx" ON "bidding"."bid_responses"("bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_receipts_bid_id_key" ON "bidding"."bid_receipts"("bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_receipts_receipt_ref_key" ON "bidding"."bid_receipts"("receipt_ref");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_workspaces_tender_id_key" ON "evaluation"."evaluation_workspaces"("tender_id");

-- CreateIndex
CREATE INDEX "evaluation_workspaces_buyer_org_id_status_idx" ON "evaluation"."evaluation_workspaces"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "workflow_assignments_user_id_idx" ON "evaluation"."workflow_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_assignments_workspace_id_user_id_assignment_key" ON "evaluation"."workflow_assignments"("workspace_id", "user_id", "assignment");

-- CreateIndex
CREATE INDEX "evaluation_criteria_workspace_id_stage_idx" ON "evaluation"."evaluation_criteria"("workspace_id", "stage");

-- CreateIndex
CREATE INDEX "evaluation_scores_workspace_id_bid_id_idx" ON "evaluation"."evaluation_scores"("workspace_id", "bid_id");

-- CreateIndex
CREATE INDEX "evaluation_scores_evaluator_user_id_idx" ON "evaluation"."evaluation_scores"("evaluator_user_id");

-- CreateIndex
CREATE INDEX "award_recommendations_workspace_id_status_idx" ON "evaluation"."award_recommendations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "award_recommendations_supplier_org_id_idx" ON "evaluation"."award_recommendations"("supplier_org_id");

-- CreateIndex
CREATE INDEX "approval_steps_recommendation_id_status_idx" ON "evaluation"."approval_steps"("recommendation_id", "status");

-- CreateIndex
CREATE INDEX "approval_steps_actor_user_id_idx" ON "evaluation"."approval_steps"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_reference_key" ON "contract"."contracts"("reference");

-- CreateIndex
CREATE INDEX "contracts_buyer_org_id_status_idx" ON "contract"."contracts"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "contracts_supplier_org_id_idx" ON "contract"."contracts"("supplier_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_versions_contract_id_version_no_key" ON "contract"."contract_versions"("contract_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_reference_key" ON "financial"."purchase_orders"("reference");

-- CreateIndex
CREATE INDEX "purchase_orders_buyer_org_id_idx" ON "financial"."purchase_orders"("buyer_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_reference_key" ON "financial"."invoices"("reference");

-- CreateIndex
CREATE INDEX "invoices_buyer_org_id_status_idx" ON "financial"."invoices"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "invoices_supplier_org_id_idx" ON "financial"."invoices"("supplier_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_objects_object_key_key" ON "documents"."document_objects"("object_key");

-- CreateIndex
CREATE INDEX "document_objects_owner_org_id_idx" ON "documents"."document_objects"("owner_org_id");

-- CreateIndex
CREATE INDEX "document_objects_uploaded_by_user_id_idx" ON "documents"."document_objects"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "audit_events_owner_org_id_created_at_idx" ON "compliance"."audit_events"("owner_org_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_ref_idx" ON "compliance"."audit_events"("entity_type", "entity_ref");

-- CreateIndex
CREATE INDEX "compliance_cases_owner_org_id_status_idx" ON "compliance"."compliance_cases"("owner_org_id", "status");

-- CreateIndex
CREATE INDEX "risk_signals_tender_id_idx" ON "compliance"."risk_signals"("tender_id");

-- CreateIndex
CREATE INDEX "risk_signals_supplier_org_id_idx" ON "compliance"."risk_signals"("supplier_org_id");

-- CreateIndex
CREATE INDEX "admin_actions_owner_org_id_idx" ON "compliance"."admin_actions"("owner_org_id");

-- CreateIndex
CREATE INDEX "admin_actions_entity_type_entity_ref_idx" ON "compliance"."admin_actions"("entity_type", "entity_ref");

-- CreateIndex
CREATE INDEX "communication_items_owner_org_id_folder_status_idx" ON "communication"."communication_items"("owner_org_id", "folder", "status");

-- CreateIndex
CREATE INDEX "communication_items_recipient_org_id_status_idx" ON "communication"."communication_items"("recipient_org_id", "status");

-- CreateIndex
CREATE INDEX "communication_items_tender_id_kind_idx" ON "communication"."communication_items"("tender_id", "kind");

-- CreateIndex
CREATE INDEX "communication_attachments_document_id_idx" ON "communication"."communication_attachments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "communication_attachments_communication_item_id_document_id_key" ON "communication"."communication_attachments"("communication_item_id", "document_id");

-- CreateIndex
CREATE INDEX "record_entries_owner_org_id_entity_type_idx" ON "records"."record_entries"("owner_org_id", "entity_type");

-- CreateIndex
CREATE INDEX "record_entries_entity_type_entity_ref_idx" ON "records"."record_entries"("entity_type", "entity_ref");

-- CreateIndex
CREATE INDEX "market_snapshots_owner_org_id_captured_at_idx" ON "intelligence"."market_snapshots"("owner_org_id", "captured_at");

-- CreateIndex
CREATE INDEX "price_benchmarks_owner_org_id_idx" ON "intelligence"."price_benchmarks"("owner_org_id");

-- CreateIndex
CREATE INDEX "price_benchmarks_tender_type_category_idx" ON "intelligence"."price_benchmarks"("tender_type", "category");

-- CreateIndex
CREATE INDEX "supplier_match_signals_tender_id_idx" ON "intelligence"."supplier_match_signals"("tender_id");

-- CreateIndex
CREATE INDEX "supplier_match_signals_supplier_org_id_idx" ON "intelligence"."supplier_match_signals"("supplier_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_registry_name_key" ON "intelligence"."module_registry"("name");

-- CreateIndex
CREATE INDEX "external_systems_owner_org_id_system_type_idx" ON "integration"."external_systems"("owner_org_id", "system_type");

-- CreateIndex
CREATE INDEX "integration_sync_runs_external_system_id_started_at_idx" ON "integration"."integration_sync_runs"("external_system_id", "started_at");

-- CreateIndex
CREATE INDEX "integration_sync_runs_owner_org_id_idx" ON "integration"."integration_sync_runs"("owner_org_id");

-- CreateIndex
CREATE INDEX "integration_events_sync_run_id_idx" ON "integration"."integration_events"("sync_run_id");

-- CreateIndex
CREATE INDEX "integration_events_owner_org_id_event_type_idx" ON "integration"."integration_events"("owner_org_id", "event_type");

-- AddForeignKey
ALTER TABLE "identity"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."verification_profiles" ADD CONSTRAINT "verification_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."verification_profiles" ADD CONSTRAINT "verification_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."verification_documents" ADD CONSTRAINT "verification_documents_verification_profile_id_fkey" FOREIGN KEY ("verification_profile_id") REFERENCES "identity"."verification_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."verification_documents" ADD CONSTRAINT "verification_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."organization_capabilities" ADD CONSTRAINT "organization_capabilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."buyer_profiles" ADD CONSTRAINT "buyer_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."supplier_profiles" ADD CONSTRAINT "supplier_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tenders" ADD CONSTRAINT "tenders_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tenders" ADD CONSTRAINT "tenders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tender_categories" ADD CONSTRAINT "tender_categories_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tender_documents" ADD CONSTRAINT "tender_documents_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tender_documents" ADD CONSTRAINT "tender_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tender_requirements" ADD CONSTRAINT "tender_requirements_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tender_milestones" ADD CONSTRAINT "tender_milestones_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."tender_commercial_items" ADD CONSTRAINT "tender_commercial_items_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bids" ADD CONSTRAINT "bids_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bids" ADD CONSTRAINT "bids_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bids" ADD CONSTRAINT "bids_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bids" ADD CONSTRAINT "bids_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_versions" ADD CONSTRAINT "bid_versions_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_documents" ADD CONSTRAINT "bid_documents_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_documents" ADD CONSTRAINT "bid_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_responses" ADD CONSTRAINT "bid_responses_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_receipts" ADD CONSTRAINT "bid_receipts_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_workspaces" ADD CONSTRAINT "evaluation_workspaces_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_workspaces" ADD CONSTRAINT "evaluation_workspaces_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "evaluation"."evaluation_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_criteria" ADD CONSTRAINT "evaluation_criteria_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "evaluation"."evaluation_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_scores" ADD CONSTRAINT "evaluation_scores_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "evaluation"."evaluation_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_scores" ADD CONSTRAINT "evaluation_scores_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "evaluation"."evaluation_criteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_scores" ADD CONSTRAINT "evaluation_scores_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluator_user_id_fkey" FOREIGN KEY ("evaluator_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."award_recommendations" ADD CONSTRAINT "award_recommendations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "evaluation"."evaluation_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."award_recommendations" ADD CONSTRAINT "award_recommendations_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."approval_steps" ADD CONSTRAINT "approval_steps_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "evaluation"."award_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contracts" ADD CONSTRAINT "contracts_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contracts" ADD CONSTRAINT "contracts_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "evaluation"."award_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contracts" ADD CONSTRAINT "contracts_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contracts" ADD CONSTRAINT "contracts_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_versions" ADD CONSTRAINT "contract_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_versions" ADD CONSTRAINT "contract_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial"."purchase_orders" ADD CONSTRAINT "purchase_orders_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial"."purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial"."invoices" ADD CONSTRAINT "invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "financial"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial"."invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial"."invoices" ADD CONSTRAINT "invoices_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial"."invoices" ADD CONSTRAINT "invoices_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."document_objects" ADD CONSTRAINT "document_objects_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."document_objects" ADD CONSTRAINT "document_objects_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."audit_events" ADD CONSTRAINT "audit_events_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."compliance_cases" ADD CONSTRAINT "compliance_cases_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."risk_signals" ADD CONSTRAINT "risk_signals_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."admin_actions" ADD CONSTRAINT "admin_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."admin_actions" ADD CONSTRAINT "admin_actions_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."communication_items" ADD CONSTRAINT "communication_items_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."communication_items" ADD CONSTRAINT "communication_items_sender_org_id_fkey" FOREIGN KEY ("sender_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."communication_items" ADD CONSTRAINT "communication_items_recipient_org_id_fkey" FOREIGN KEY ("recipient_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."communication_items" ADD CONSTRAINT "communication_items_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."communication_attachments" ADD CONSTRAINT "communication_attachments_communication_item_id_fkey" FOREIGN KEY ("communication_item_id") REFERENCES "communication"."communication_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication"."communication_attachments" ADD CONSTRAINT "communication_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence"."supplier_match_signals" ADD CONSTRAINT "supplier_match_signals_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration"."integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_external_system_id_fkey" FOREIGN KEY ("external_system_id") REFERENCES "integration"."external_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration"."integration_events" ADD CONSTRAINT "integration_events_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "integration"."integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- App context and row-level security

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_account_type()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(COALESCE(NULLIF(current_setting('app.current_account_type', true), ''), 'user'));
$$;

CREATE OR REPLACE FUNCTION app.current_capabilities()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.current_capabilities', true), '') IS NULL THEN ARRAY[]::text[]
    ELSE regexp_split_to_array(lower(current_setting('app.current_capabilities', true)), '\s*,\s*')
  END;
$$;

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_account_type() = 'admin';
$$;

CREATE OR REPLACE FUNCTION app.same_org(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT org_id IS NOT NULL AND org_id = app.current_organization_id();
$$;

CREATE OR REPLACE FUNCTION app.has_capability(capability_name text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(capability_name) = ANY(app.current_capabilities());
$$;



DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('organization', 'organizations', 'id'),
      ('organization', 'organization_members', 'organization_id'),
      ('organization', 'organization_capabilities', 'organization_id'),
      ('organization', 'organization_profiles', 'organization_id'),
      ('organization', 'buyer_profiles', 'organization_id'),
      ('organization', 'supplier_profiles', 'organization_id'),
      ('documents', 'document_objects', 'owner_org_id'),
      ('procurement', 'tenders', 'buyer_org_id'),
      ('procurement', 'tender_requirements', NULL),
      ('procurement', 'tender_milestones', NULL),
      ('procurement', 'tender_commercial_items', NULL),
      ('bidding', 'bids', 'supplier_org_id'),
      ('contract', 'contracts', 'buyer_org_id'),
      ('financial', 'purchase_orders', 'buyer_org_id'),
      ('financial', 'invoices', 'buyer_org_id'),
      ('communication', 'communication_items', 'owner_org_id'),
      ('compliance', 'audit_events', 'owner_org_id'),
      ('compliance', 'compliance_cases', 'owner_org_id'),
      ('compliance', 'admin_actions', 'owner_org_id')
    ) AS t(schema_name, table_name, org_column)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target.schema_name, target.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', target.schema_name, target.table_name);

    IF target.org_column IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I.%I FOR ALL USING (app.is_admin() OR app.same_org(%I)) WITH CHECK (app.is_admin() OR app.same_org(%I))',
        target.schema_name,
        target.table_name,
        target.org_column,
        target.org_column
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_self_or_admin ON identity.users
  FOR ALL
  USING (app.is_admin() OR id = app.current_user_id())
  WITH CHECK (app.is_admin() OR id = app.current_user_id());

ALTER TABLE identity.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY accounts_self_or_admin ON identity.accounts
  FOR ALL
  USING (app.is_admin() OR user_id = app.current_user_id())
  WITH CHECK (app.is_admin() OR user_id = app.current_user_id());

ALTER TABLE identity.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_self_or_admin ON identity.sessions
  FOR ALL
  USING (app.is_admin() OR user_id = app.current_user_id())
  WITH CHECK (app.is_admin() OR user_id = app.current_user_id());

ALTER TABLE identity.verification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.verification_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY verification_self_org_or_admin ON identity.verification_profiles
  FOR ALL
  USING (app.is_admin() OR user_id = app.current_user_id() OR app.same_org(organization_id))
  WITH CHECK (app.is_admin() OR user_id = app.current_user_id() OR app.same_org(organization_id));

ALTER TABLE procurement.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.tenders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON procurement.tenders;
CREATE POLICY tenders_company_or_public ON procurement.tenders
  FOR SELECT
  USING (app.is_admin() OR app.same_org(buyer_org_id) OR (visibility = 'PUBLIC_MARKETPLACE' AND status IN ('PUBLISHED', 'OPEN')));
CREATE POLICY tenders_buyer_write ON procurement.tenders
  FOR INSERT
  WITH CHECK (app.is_admin() OR (app.same_org(buyer_org_id) AND app.has_capability('buyer')));
CREATE POLICY tenders_buyer_update ON procurement.tenders
  FOR UPDATE
  USING (app.is_admin() OR app.same_org(buyer_org_id))
  WITH CHECK (app.is_admin() OR (app.same_org(buyer_org_id) AND app.has_capability('buyer')));
CREATE POLICY tenders_buyer_delete ON procurement.tenders
  FOR DELETE
  USING (app.is_admin() OR (app.same_org(buyer_org_id) AND app.has_capability('buyer')));

CREATE POLICY tender_requirements_parent_access ON procurement.tender_requirements
  FOR ALL
  USING (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM procurement.tenders t
      WHERE t.id = tender_id
      AND app.same_org(t.buyer_org_id)
    )
  )
  WITH CHECK (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM procurement.tenders t
      WHERE t.id = tender_id
      AND app.same_org(t.buyer_org_id)
    )
  );

CREATE POLICY tender_milestones_parent_access ON procurement.tender_milestones
  FOR ALL
  USING (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM procurement.tenders t
      WHERE t.id = tender_id
      AND app.same_org(t.buyer_org_id)
    )
  )
  WITH CHECK (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM procurement.tenders t
      WHERE t.id = tender_id
      AND app.same_org(t.buyer_org_id)
    )
  );

CREATE POLICY tender_commercial_items_parent_access ON procurement.tender_commercial_items
  FOR ALL
  USING (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM procurement.tenders t
      WHERE t.id = tender_id
      AND app.same_org(t.buyer_org_id)
    )
  )
  WITH CHECK (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM procurement.tenders t
      WHERE t.id = tender_id
      AND app.same_org(t.buyer_org_id)
    )
  );

ALTER TABLE bidding.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bidding.bids FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON bidding.bids;
CREATE POLICY bids_buyer_or_supplier_select ON bidding.bids
  FOR SELECT
  USING (app.is_admin() OR app.same_org(buyer_org_id) OR app.same_org(supplier_org_id));
CREATE POLICY bids_supplier_write ON bidding.bids
  FOR INSERT
  WITH CHECK (app.is_admin() OR (app.same_org(supplier_org_id) AND app.has_capability('supplier')));
CREATE POLICY bids_supplier_update ON bidding.bids
  FOR UPDATE
  USING (app.is_admin() OR app.same_org(supplier_org_id))
  WITH CHECK (app.is_admin() OR (app.same_org(supplier_org_id) AND app.has_capability('supplier')));

ALTER TABLE evaluation.evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation.evaluation_scores FORCE ROW LEVEL SECURITY;
CREATE POLICY evaluation_scores_read ON evaluation.evaluation_scores
  FOR SELECT
  USING (
    app.is_admin()
    OR EXISTS (
      SELECT 1
      FROM evaluation.evaluation_workspaces ew
      WHERE ew.id = workspace_id
      AND app.same_org(ew.buyer_org_id)
    )
  );
CREATE POLICY evaluation_scores_insert ON evaluation.evaluation_scores
  FOR INSERT
  WITH CHECK (
    app.is_admin() = false
    AND EXISTS (
      SELECT 1
      FROM evaluation.evaluation_workspaces ew
      WHERE ew.id = workspace_id
      AND app.same_org(ew.buyer_org_id)
    )
  );
CREATE POLICY evaluation_scores_update ON evaluation.evaluation_scores
  FOR UPDATE
  USING (
    app.is_admin() = false
    AND EXISTS (
      SELECT 1
      FROM evaluation.evaluation_workspaces ew
      WHERE ew.id = workspace_id
      AND app.same_org(ew.buyer_org_id)
    )
  )
  WITH CHECK (
    app.is_admin() = false
    AND EXISTS (
      SELECT 1
      FROM evaluation.evaluation_workspaces ew
      WHERE ew.id = workspace_id
      AND app.same_org(ew.buyer_org_id)
    )
  );
