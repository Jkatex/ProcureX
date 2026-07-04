-- CreateTable
CREATE TABLE "procurement"."saved_tenders" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_tenders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_tenders_tender_id_organization_id_key" ON "procurement"."saved_tenders"("tender_id", "organization_id");

-- CreateIndex
CREATE INDEX "saved_tenders_organization_id_created_at_idx" ON "procurement"."saved_tenders"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_tenders_user_id_created_at_idx" ON "procurement"."saved_tenders"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "procurement"."saved_tenders" ADD CONSTRAINT "saved_tenders_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."saved_tenders" ADD CONSTRAINT "saved_tenders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."saved_tenders" ADD CONSTRAINT "saved_tenders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
