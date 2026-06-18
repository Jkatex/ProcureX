CREATE TABLE "identity"."signing_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "public_key_pem" TEXT NOT NULL,
  "key_fingerprint" TEXT NOT NULL,
  "encrypted_private_key" TEXT NOT NULL,
  "kdf_metadata" JSONB NOT NULL DEFAULT '{}',
  "encryption_metadata" JSONB NOT NULL DEFAULT '{}',
  "provider_metadata" JSONB NOT NULL DEFAULT '{}',
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "signing_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signing_credentials_key_fingerprint_key" ON "identity"."signing_credentials"("key_fingerprint");
CREATE INDEX "signing_credentials_user_id_status_idx" ON "identity"."signing_credentials"("user_id", "status");

ALTER TABLE "identity"."signing_credentials"
ADD CONSTRAINT "signing_credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
