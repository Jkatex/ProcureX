CREATE TABLE "identity"."keyphrase_recoveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "organization_id" UUID,
  "email_challenge_id" UUID,
  "phone_challenge_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "email" TEXT NOT NULL,
  "phone_masked" TEXT,
  "email_verified_at" TIMESTAMP(3),
  "phone_verified_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "old_key_fingerprint" TEXT,
  "new_key_fingerprint" TEXT,
  "request_metadata" JSONB NOT NULL DEFAULT '{}',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "keyphrase_recoveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "keyphrase_recoveries_user_id_created_at_idx" ON "identity"."keyphrase_recoveries"("user_id", "created_at");
CREATE INDEX "keyphrase_recoveries_organization_id_created_at_idx" ON "identity"."keyphrase_recoveries"("organization_id", "created_at");
CREATE INDEX "keyphrase_recoveries_status_created_at_idx" ON "identity"."keyphrase_recoveries"("status", "created_at");

ALTER TABLE "identity"."keyphrase_recoveries"
  ADD CONSTRAINT "keyphrase_recoveries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "identity"."keyphrase_recoveries"
  ADD CONSTRAINT "keyphrase_recoveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
