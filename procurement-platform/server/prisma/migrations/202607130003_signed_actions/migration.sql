CREATE TABLE "identity"."signed_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "organization_id" UUID,
  "signing_credential_id" UUID NOT NULL,
  "module_key" TEXT NOT NULL,
  "action_key" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_ref" TEXT NOT NULL,
  "canonical_payload_hash" TEXT NOT NULL,
  "signature_hash" TEXT NOT NULL,
  "key_fingerprint" TEXT NOT NULL,
  "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_metadata" JSONB NOT NULL DEFAULT '{}',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "provider_metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "signed_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signed_actions_signature_hash_key" ON "identity"."signed_actions"("signature_hash");
CREATE INDEX "signed_actions_user_id_signed_at_idx" ON "identity"."signed_actions"("user_id", "signed_at");
CREATE INDEX "signed_actions_organization_id_signed_at_idx" ON "identity"."signed_actions"("organization_id", "signed_at");
CREATE INDEX "signed_actions_module_key_action_key_idx" ON "identity"."signed_actions"("module_key", "action_key");
CREATE INDEX "signed_actions_entity_type_entity_ref_idx" ON "identity"."signed_actions"("entity_type", "entity_ref");

ALTER TABLE "identity"."signed_actions"
  ADD CONSTRAINT "signed_actions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity"."signed_actions"
  ADD CONSTRAINT "signed_actions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "identity"."signed_actions"
  ADD CONSTRAINT "signed_actions_signing_credential_id_fkey"
  FOREIGN KEY ("signing_credential_id") REFERENCES "identity"."signing_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
