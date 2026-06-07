-- Identity registration challenges and deterministic registry lookup records.

CREATE TABLE "identity"."identity_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "purpose" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "identity_challenges_user_id_purpose_status_idx"
  ON "identity"."identity_challenges"("user_id", "purpose", "status");

CREATE INDEX "identity_challenges_target_purpose_status_idx"
  ON "identity"."identity_challenges"("target", "purpose", "status");

ALTER TABLE "identity"."identity_challenges"
  ADD CONSTRAINT "identity_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "integration"."registry_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "registry_number" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MATCHED',
    "confidence" INTEGER NOT NULL DEFAULT 95,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registry_records_source_registry_number_key"
  ON "integration"."registry_records"("source", "registry_number");

CREATE INDEX "registry_records_source_entity_type_idx"
  ON "integration"."registry_records"("source", "entity_type");

INSERT INTO "integration"."registry_records"
  ("source", "registry_number", "entity_type", "name", "status", "confidence", "payload")
VALUES
  (
    'TRA',
    '123-456-789',
    'individual',
    'Mariam Saidi Nyoni',
    'MATCHED',
    98,
    '{"tin":"123-456-789","email":"mariam.nyoni@example.co.tz","mobileNumber":"0718 462 390","physicalAddress":"Plot 24, Mbezi Beach, Dar es Salaam","postalAddress":"P.O. Box 20418","taxRegion":"DSM","registeredOn":"2022-05-18","summaryRows":[["Name","Mariam Saidi Nyoni"],["Taxpayer Identification Number","123-456-789"],["Status","CER"],["Location","Dar es Salaam, Tanzania"]]}'::jsonb
  ),
  (
    'BRELA',
    '123456789',
    'company',
    'Kilimanjaro Supplies Limited',
    'MATCHED',
    97,
    '{"registrationNumber":"123456789","companyType":"Private limited company","registeredOn":"2021-02-12","location":"Arusha, Tanzania","summaryRows":[["Company name","Kilimanjaro Supplies Limited"],["BRELA number","123456789"],["Status","Active"],["Location","Arusha, Tanzania"]]}'::jsonb
  ),
  (
    'BRELA',
    'BN-123456',
    'business',
    'Zahra Omari Business Services',
    'MATCHED',
    96,
    '{"businessNumber":"BN-123456","registrationMethod":"BRELA business name","registeredOn":"2023-09-04","location":"Dodoma, Tanzania","summaryRows":[["Business name","Zahra Omari Business Services"],["Business number","BN-123456"],["Status","Active"],["Location","Dodoma, Tanzania"]]}'::jsonb
  )
ON CONFLICT ("source", "registry_number") DO NOTHING;
