ALTER TABLE "financial"."invoices"
  ADD COLUMN IF NOT EXISTS "execution_reference_type" TEXT,
  ADD COLUMN IF NOT EXISTS "execution_reference_id" UUID,
  ADD COLUMN IF NOT EXISTS "visibility_scope" TEXT NOT NULL DEFAULT 'SHARED';

UPDATE "financial"."invoices"
SET
  "execution_reference_type" = COALESCE("execution_reference_type", NULLIF("payload"->>'executionReferenceType', '')),
  "execution_reference_id" = COALESCE(
    "execution_reference_id",
    CASE
      WHEN ("payload"->>'executionReferenceId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN ("payload"->>'executionReferenceId')::uuid
      ELSE NULL
    END
  ),
  "visibility_scope" = COALESCE(NULLIF("payload"->>'visibilityScope', ''), "visibility_scope", 'SHARED');

CREATE INDEX IF NOT EXISTS "invoices_contract_execution_reference_idx"
  ON "financial"."invoices"("contract_id", "execution_reference_type", "execution_reference_id");
