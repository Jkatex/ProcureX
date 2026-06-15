-- CreateEnum
CREATE TYPE "contract"."AwardNoticeStatus" AS ENUM ('PENDING_RESPONSE', 'ACCEPTED', 'CLARIFICATION_REQUESTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "contract"."AwardResponseAction" AS ENUM ('ACCEPT', 'REQUEST_CLARIFICATION', 'DECLINE');

-- CreateEnum
CREATE TYPE "contract"."ContractPartyRole" AS ENUM ('BUYER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "contract"."ContractMilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "contract"."award_notices" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "buyer_org_id" UUID NOT NULL,
    "supplier_org_id" UUID NOT NULL,
    "contract_id" UUID,
    "issued_by_user_id" UUID,
    "responded_by_user_id" UUID,
    "status" "contract"."AwardNoticeStatus" NOT NULL DEFAULT 'PENDING_RESPONSE',
    "buyer_note" TEXT,
    "supplier_note" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract"."award_responses" (
    "id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_org_id" UUID,
    "action" "contract"."AwardResponseAction" NOT NULL,
    "note" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract"."contract_signatures" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "signer_user_id" UUID,
    "signer_org_id" UUID,
    "role" "contract"."ContractPartyRole" NOT NULL,
    "status" "contract"."SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signer_name" TEXT,
    "signer_title" TEXT,
    "canonical_payload_hash" TEXT,
    "signature_hash" TEXT,
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "provider_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract"."contract_milestones" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "contract"."ContractMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "amount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract"."contract_milestone_evidence" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID,
    "uploader_org_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_milestone_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "award_notices_recommendation_id_key" ON "contract"."award_notices"("recommendation_id");

-- CreateIndex
CREATE UNIQUE INDEX "award_notices_contract_id_key" ON "contract"."award_notices"("contract_id");

-- CreateIndex
CREATE INDEX "award_notices_buyer_org_id_status_idx" ON "contract"."award_notices"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "award_notices_supplier_org_id_status_idx" ON "contract"."award_notices"("supplier_org_id", "status");

-- CreateIndex
CREATE INDEX "award_notices_issued_at_idx" ON "contract"."award_notices"("issued_at");

-- CreateIndex
CREATE INDEX "award_responses_notice_id_created_at_idx" ON "contract"."award_responses"("notice_id", "created_at");

-- CreateIndex
CREATE INDEX "award_responses_actor_org_id_created_at_idx" ON "contract"."award_responses"("actor_org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signatures_signature_hash_key" ON "contract"."contract_signatures"("signature_hash");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signatures_contract_id_signer_org_id_role_key" ON "contract"."contract_signatures"("contract_id", "signer_org_id", "role");

-- CreateIndex
CREATE INDEX "contract_signatures_contract_id_status_idx" ON "contract"."contract_signatures"("contract_id", "status");

-- CreateIndex
CREATE INDEX "contract_signatures_signer_org_id_status_idx" ON "contract"."contract_signatures"("signer_org_id", "status");

-- CreateIndex
CREATE INDEX "contract_milestones_contract_id_status_idx" ON "contract"."contract_milestones"("contract_id", "status");

-- CreateIndex
CREATE INDEX "contract_milestones_due_date_idx" ON "contract"."contract_milestones"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "contract_milestone_evidence_milestone_id_document_id_key" ON "contract"."contract_milestone_evidence"("milestone_id", "document_id");

-- CreateIndex
CREATE INDEX "contract_milestone_evidence_document_id_idx" ON "contract"."contract_milestone_evidence"("document_id");

-- CreateIndex
CREATE INDEX "contract_milestone_evidence_uploader_org_id_idx" ON "contract"."contract_milestone_evidence"("uploader_org_id");

-- AddForeignKey
ALTER TABLE "contract"."award_notices" ADD CONSTRAINT "award_notices_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "evaluation"."award_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_notices" ADD CONSTRAINT "award_notices_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_notices" ADD CONSTRAINT "award_notices_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_notices" ADD CONSTRAINT "award_notices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_notices" ADD CONSTRAINT "award_notices_issued_by_user_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_notices" ADD CONSTRAINT "award_notices_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_responses" ADD CONSTRAINT "award_responses_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "contract"."award_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_responses" ADD CONSTRAINT "award_responses_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."award_responses" ADD CONSTRAINT "award_responses_actor_org_id_fkey" FOREIGN KEY ("actor_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_signatures" ADD CONSTRAINT "contract_signatures_signer_user_id_fkey" FOREIGN KEY ("signer_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_signatures" ADD CONSTRAINT "contract_signatures_signer_org_id_fkey" FOREIGN KEY ("signer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_milestones" ADD CONSTRAINT "contract_milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_milestone_evidence" ADD CONSTRAINT "contract_milestone_evidence_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "contract"."contract_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_milestone_evidence" ADD CONSTRAINT "contract_milestone_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."document_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_milestone_evidence" ADD CONSTRAINT "contract_milestone_evidence_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract"."contract_milestone_evidence" ADD CONSTRAINT "contract_milestone_evidence_uploader_org_id_fkey" FOREIGN KEY ("uploader_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
