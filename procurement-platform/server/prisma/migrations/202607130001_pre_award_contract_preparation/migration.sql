CREATE UNIQUE INDEX IF NOT EXISTS "contracts_pre_award_draft_tender_buyer_key"
  ON "contract"."contracts"("tender_id", "buyer_org_id")
  WHERE "award_id" IS NULL AND "supplier_org_id" IS NULL;
