-- Production identity verification signatures and immutable profile history.

CREATE TABLE "identity"."verification_profile_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verification_profile_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "status" "identity"."VerificationStatus" NOT NULL,
    "registry_source" TEXT,
    "registry_number" TEXT,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_profile_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verification_profile_history_verification_profile_id_created_at_idx"
  ON "identity"."verification_profile_history"("verification_profile_id", "created_at");

CREATE INDEX "verification_profile_history_user_id_created_at_idx"
  ON "identity"."verification_profile_history"("user_id", "created_at");

ALTER TABLE "identity"."verification_profile_history"
  ADD CONSTRAINT "verification_profile_history_verification_profile_id_fkey"
  FOREIGN KEY ("verification_profile_id") REFERENCES "identity"."verification_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity"."verification_profile_history"
  ADD CONSTRAINT "verification_profile_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity"."verification_profile_history"
  ADD CONSTRAINT "verification_profile_history_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "identity"."digital_signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verification_profile_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "signer_name" TEXT NOT NULL,
    "signer_title" TEXT,
    "consent_version" TEXT NOT NULL,
    "consent_title" TEXT NOT NULL,
    "canonical_payload_hash" TEXT NOT NULL,
    "signature_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIGNED',
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "provider_metadata" JSONB NOT NULL DEFAULT '{}',
    "blockchain_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "digital_signatures_verification_profile_id_signed_at_idx"
  ON "identity"."digital_signatures"("verification_profile_id", "signed_at");

CREATE INDEX "digital_signatures_user_id_signed_at_idx"
  ON "identity"."digital_signatures"("user_id", "signed_at");

CREATE INDEX "digital_signatures_signature_hash_idx"
  ON "identity"."digital_signatures"("signature_hash");

ALTER TABLE "identity"."digital_signatures"
  ADD CONSTRAINT "digital_signatures_verification_profile_id_fkey"
  FOREIGN KEY ("verification_profile_id") REFERENCES "identity"."verification_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity"."digital_signatures"
  ADD CONSTRAINT "digital_signatures_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity"."digital_signatures"
  ADD CONSTRAINT "digital_signatures_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
