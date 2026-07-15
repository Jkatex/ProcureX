CREATE TABLE "contract"."contract_notices" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "notice_type" TEXT NOT NULL DEFAULT 'ORDINARY_MESSAGE',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sender_role" TEXT,
    "recipient_role" TEXT,
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "related_record_type" TEXT,
    "related_record_id" UUID,
    "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED',
    "response" TEXT,
    "note" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_meetings" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "meeting_type" TEXT NOT NULL DEFAULT 'PROGRESS_MEETING',
    "title" TEXT NOT NULL,
    "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
    "meeting_date" TIMESTAMP(3),
    "participants" JSONB NOT NULL DEFAULT '[]',
    "agenda" TEXT,
    "minutes" TEXT,
    "decisions" TEXT,
    "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED',
    "note" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_meetings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract"."contract_meeting_actions" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "owner_role" TEXT NOT NULL DEFAULT 'SHARED',
    "status" "contract"."ContractLifecycleItemStatus" NOT NULL DEFAULT 'OPEN',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "response" TEXT,
    "verification_note" TEXT,
    "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED',
    "note" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_meeting_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_notices_contract_id_status_idx" ON "contract"."contract_notices"("contract_id", "status");
CREATE INDEX "contract_notices_contract_id_notice_type_idx" ON "contract"."contract_notices"("contract_id", "notice_type");
CREATE INDEX "contract_notices_due_date_idx" ON "contract"."contract_notices"("due_date");
CREATE INDEX "contract_meetings_contract_id_status_idx" ON "contract"."contract_meetings"("contract_id", "status");
CREATE INDEX "contract_meetings_meeting_date_idx" ON "contract"."contract_meetings"("meeting_date");
CREATE INDEX "contract_meeting_actions_contract_id_status_idx" ON "contract"."contract_meeting_actions"("contract_id", "status");
CREATE INDEX "contract_meeting_actions_meeting_id_idx" ON "contract"."contract_meeting_actions"("meeting_id");
CREATE INDEX "contract_meeting_actions_due_date_idx" ON "contract"."contract_meeting_actions"("due_date");

ALTER TABLE "contract"."contract_notices" ADD CONSTRAINT "contract_notices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_meetings" ADD CONSTRAINT "contract_meetings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_meeting_actions" ADD CONSTRAINT "contract_meeting_actions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"."contract_meeting_actions" ADD CONSTRAINT "contract_meeting_actions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "contract"."contract_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
