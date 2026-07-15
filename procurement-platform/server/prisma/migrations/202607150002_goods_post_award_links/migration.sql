ALTER TABLE "contract"."contract_acceptances"
  ADD COLUMN IF NOT EXISTS "goods_receipt_id" UUID,
  ADD COLUMN IF NOT EXISTS "goods_inspection_id" UUID;

CREATE INDEX IF NOT EXISTS "contract_acceptances_goods_receipt_id_idx"
  ON "contract"."contract_acceptances"("goods_receipt_id");

CREATE INDEX IF NOT EXISTS "contract_acceptances_goods_inspection_id_idx"
  ON "contract"."contract_acceptances"("goods_inspection_id");

ALTER TABLE "financial"."three_way_match_results"
  ADD COLUMN IF NOT EXISTS "goods_receipt_id" UUID,
  ADD COLUMN IF NOT EXISTS "goods_inspection_id" UUID,
  ADD COLUMN IF NOT EXISTS "schedule_id" UUID,
  ADD COLUMN IF NOT EXISTS "mismatch_type" TEXT;

CREATE INDEX IF NOT EXISTS "three_way_match_results_acceptance_id_idx"
  ON "financial"."three_way_match_results"("acceptance_id");

CREATE INDEX IF NOT EXISTS "three_way_match_results_goods_receipt_id_idx"
  ON "financial"."three_way_match_results"("goods_receipt_id");

CREATE INDEX IF NOT EXISTS "three_way_match_results_goods_inspection_id_idx"
  ON "financial"."three_way_match_results"("goods_inspection_id");

CREATE INDEX IF NOT EXISTS "three_way_match_results_schedule_id_idx"
  ON "financial"."three_way_match_results"("schedule_id");
