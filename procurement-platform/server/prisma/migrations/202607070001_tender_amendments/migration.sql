CREATE TYPE "procurement"."TenderAmendmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

CREATE TABLE "procurement"."tender_amendments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tender_id" UUID NOT NULL,
    "buyer_org_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "procurement"."TenderAmendmentStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_amendments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tender_amendments_reference_key" ON "procurement"."tender_amendments"("reference");
CREATE INDEX "tender_amendments_tender_id_status_created_at_idx" ON "procurement"."tender_amendments"("tender_id", "status", "created_at");
CREATE INDEX "tender_amendments_buyer_org_id_status_idx" ON "procurement"."tender_amendments"("buyer_org_id", "status");

ALTER TABLE "procurement"."tender_amendments"
ADD CONSTRAINT "tender_amendments_tender_id_fkey"
FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "procurement"."tender_amendments"
ADD CONSTRAINT "tender_amendments_buyer_org_id_fkey"
FOREIGN KEY ("buyer_org_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "procurement"."tender_amendments"
ADD CONSTRAINT "tender_amendments_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
