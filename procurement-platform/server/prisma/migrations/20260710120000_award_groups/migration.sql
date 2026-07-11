-- Add award grouping so award settlement can carry multi-winner records,
-- award-stage clauses, negotiations, and generated bid packs.

ALTER TABLE "evaluation"."award_recommendations"
  ADD COLUMN "award_group_id" UUID;

CREATE TABLE "evaluation"."award_groups" (
  "id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "workspace_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "buyer_org_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEGOTIATION',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "settled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "award_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."award_winners" (
  "id" UUID NOT NULL,
  "award_group_id" UUID NOT NULL,
  "recommendation_id" UUID,
  "bid_id" UUID,
  "supplier_org_id" UUID,
  "notice_id" UUID,
  "contract_id" UUID,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" TEXT NOT NULL DEFAULT 'RECOMMENDED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "award_winners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."award_clauses" (
  "id" UUID NOT NULL,
  "award_group_id" UUID NOT NULL,
  "winner_id" UUID,
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

  CONSTRAINT "award_clauses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."award_negotiations" (
  "id" UUID NOT NULL,
  "award_group_id" UUID NOT NULL,
  "winner_id" UUID,
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

  CONSTRAINT "award_negotiations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation"."award_bid_packs" (
  "id" UUID NOT NULL,
  "award_group_id" UUID NOT NULL,
  "document_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "checksum" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "award_bid_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "award_groups_reference_key" ON "evaluation"."award_groups"("reference");
CREATE INDEX "award_groups_workspace_id_status_idx" ON "evaluation"."award_groups"("workspace_id", "status");
CREATE INDEX "award_groups_buyer_org_id_status_idx" ON "evaluation"."award_groups"("buyer_org_id", "status");
CREATE INDEX "award_groups_tender_id_idx" ON "evaluation"."award_groups"("tender_id");

CREATE UNIQUE INDEX "award_winners_recommendation_id_key" ON "evaluation"."award_winners"("recommendation_id");
CREATE INDEX "award_winners_award_group_id_status_idx" ON "evaluation"."award_winners"("award_group_id", "status");
CREATE INDEX "award_winners_supplier_org_id_idx" ON "evaluation"."award_winners"("supplier_org_id");
CREATE INDEX "award_winners_bid_id_idx" ON "evaluation"."award_winners"("bid_id");

CREATE UNIQUE INDEX "award_clauses_award_group_id_clause_key_key" ON "evaluation"."award_clauses"("award_group_id", "clause_key");
CREATE INDEX "award_clauses_award_group_id_status_idx" ON "evaluation"."award_clauses"("award_group_id", "status");
CREATE INDEX "award_clauses_winner_id_idx" ON "evaluation"."award_clauses"("winner_id");

CREATE INDEX "award_negotiations_award_group_id_status_idx" ON "evaluation"."award_negotiations"("award_group_id", "status");
CREATE INDEX "award_negotiations_winner_id_idx" ON "evaluation"."award_negotiations"("winner_id");
CREATE INDEX "award_negotiations_clause_id_idx" ON "evaluation"."award_negotiations"("clause_id");

CREATE INDEX "award_bid_packs_award_group_id_status_idx" ON "evaluation"."award_bid_packs"("award_group_id", "status");
CREATE INDEX "award_bid_packs_document_id_idx" ON "evaluation"."award_bid_packs"("document_id");

CREATE INDEX "award_recommendations_award_group_id_idx" ON "evaluation"."award_recommendations"("award_group_id");

ALTER TABLE "evaluation"."award_groups"
  ADD CONSTRAINT "award_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "evaluation"."evaluation_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation"."award_recommendations"
  ADD CONSTRAINT "award_recommendations_award_group_id_fkey" FOREIGN KEY ("award_group_id") REFERENCES "evaluation"."award_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "evaluation"."award_winners"
  ADD CONSTRAINT "award_winners_award_group_id_fkey" FOREIGN KEY ("award_group_id") REFERENCES "evaluation"."award_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation"."award_clauses"
  ADD CONSTRAINT "award_clauses_award_group_id_fkey" FOREIGN KEY ("award_group_id") REFERENCES "evaluation"."award_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation"."award_negotiations"
  ADD CONSTRAINT "award_negotiations_award_group_id_fkey" FOREIGN KEY ("award_group_id") REFERENCES "evaluation"."award_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation"."award_bid_packs"
  ADD CONSTRAINT "award_bid_packs_award_group_id_fkey" FOREIGN KEY ("award_group_id") REFERENCES "evaluation"."award_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "evaluation"."award_groups" (
  "id",
  "reference",
  "workspace_id",
  "tender_id",
  "buyer_org_id",
  "title",
  "status",
  "payload",
  "settled_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  'PX-AG-' || ar."reference",
  ar."workspace_id",
  ew."tender_id",
  ew."buyer_org_id",
  t."title",
  CASE
    WHEN an."contract_id" IS NOT NULL THEN 'CONTRACT_FORMED'
    WHEN an."status" IS NOT NULL THEN 'NOTICED'
    WHEN ar."status" = 'APPROVED' THEN 'SETTLED'
    ELSE 'NEGOTIATION'
  END,
  jsonb_build_object('backfilledFromRecommendationId', ar."id"),
  CASE WHEN ar."status" = 'APPROVED' THEN COALESCE(an."issued_at", ar."created_at") ELSE NULL END,
  ar."created_at",
  CURRENT_TIMESTAMP
FROM "evaluation"."award_recommendations" ar
JOIN "evaluation"."evaluation_workspaces" ew ON ew."id" = ar."workspace_id"
JOIN "procurement"."tenders" t ON t."id" = ew."tender_id"
LEFT JOIN "contract"."award_notices" an ON an."recommendation_id" = ar."id"
WHERE ar."award_group_id" IS NULL;

UPDATE "evaluation"."award_recommendations" ar
SET "award_group_id" = ag."id"
FROM "evaluation"."award_groups" ag
WHERE ag."payload"->>'backfilledFromRecommendationId' = ar."id"::text
  AND ar."award_group_id" IS NULL;

INSERT INTO "evaluation"."award_winners" (
  "id",
  "award_group_id",
  "recommendation_id",
  "bid_id",
  "supplier_org_id",
  "notice_id",
  "contract_id",
  "amount",
  "currency",
  "status",
  "payload",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  ar."award_group_id",
  ar."id",
  ar."bid_id",
  ar."supplier_org_id",
  an."id",
  COALESCE(an."contract_id", c."id"),
  ar."amount",
  ar."currency",
  COALESCE(an."status"::text, ar."status"::text),
  jsonb_build_object('backfilled', true),
  ar."created_at",
  CURRENT_TIMESTAMP
FROM "evaluation"."award_recommendations" ar
LEFT JOIN "contract"."award_notices" an ON an."recommendation_id" = ar."id"
LEFT JOIN LATERAL (
  SELECT "id"
  FROM "contract"."contracts"
  WHERE "award_id" = ar."id"
  ORDER BY "created_at" ASC
  LIMIT 1
) c ON true
WHERE ar."award_group_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "evaluation"."award_winners" aw WHERE aw."recommendation_id" = ar."id"
  );
