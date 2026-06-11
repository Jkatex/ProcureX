-- P1 IAM access, deterministic screening, and progressive trust records.

CREATE TABLE "identity"."screening_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "verification_profile_id" UUID,
    "organization_id" UUID,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "provider_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "screening_checks_user_id_created_at_idx"
  ON "identity"."screening_checks"("user_id", "created_at");

CREATE INDEX "screening_checks_verification_profile_id_created_at_idx"
  ON "identity"."screening_checks"("verification_profile_id", "created_at");

CREATE INDEX "screening_checks_organization_id_created_at_idx"
  ON "identity"."screening_checks"("organization_id", "created_at");

CREATE INDEX "screening_checks_status_idx"
  ON "identity"."screening_checks"("status");

ALTER TABLE "identity"."screening_checks"
  ADD CONSTRAINT "screening_checks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity"."screening_checks"
  ADD CONSTRAINT "screening_checks_verification_profile_id_fkey"
  FOREIGN KEY ("verification_profile_id") REFERENCES "identity"."verification_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "identity"."screening_checks"
  ADD CONSTRAINT "screening_checks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "organization"."trust_tier_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "user_id" UUID,
    "verification_profile_id" UUID,
    "previous_tier" "organization"."TrustTier",
    "next_tier" "organization"."TrustTier" NOT NULL,
    "risk_level" "organization"."RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_tier_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trust_tier_history_organization_id_created_at_idx"
  ON "organization"."trust_tier_history"("organization_id", "created_at");

CREATE INDEX "trust_tier_history_user_id_created_at_idx"
  ON "organization"."trust_tier_history"("user_id", "created_at");

CREATE INDEX "trust_tier_history_verification_profile_id_created_at_idx"
  ON "organization"."trust_tier_history"("verification_profile_id", "created_at");

ALTER TABLE "organization"."trust_tier_history"
  ADD CONSTRAINT "trust_tier_history_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization"."trust_tier_history"
  ADD CONSTRAINT "trust_tier_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization"."trust_tier_history"
  ADD CONSTRAINT "trust_tier_history_verification_profile_id_fkey"
  FOREIGN KEY ("verification_profile_id") REFERENCES "identity"."verification_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "organization"."permission_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "organization_id" UUID,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'ALLOW',
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "permission_overrides_user_id_permission_idx"
  ON "organization"."permission_overrides"("user_id", "permission");

CREATE INDEX "permission_overrides_organization_id_permission_idx"
  ON "organization"."permission_overrides"("organization_id", "permission");

ALTER TABLE "organization"."permission_overrides"
  ADD CONSTRAINT "permission_overrides_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization"."permission_overrides"
  ADD CONSTRAINT "permission_overrides_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
