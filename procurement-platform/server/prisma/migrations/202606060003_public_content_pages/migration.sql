-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "content";

-- CreateEnum
CREATE TYPE "content"."PublicPageKey" AS ENUM ('ABOUT_PROCUREX', 'PRIVACY_POLICY', 'TERMS_AND_CONDITIONS');

-- CreateEnum
CREATE TYPE "content"."PublicPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "content"."public_page_versions" (
    "id" UUID NOT NULL,
    "page_key" "content"."PublicPageKey" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "content"."PublicPageStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "content_hash" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user_policy_acceptances" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "terms_version_id" UUID NOT NULL,
    "privacy_version_id" UUID NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'registration',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "user_policy_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_page_versions_page_key_version_key" ON "content"."public_page_versions"("page_key", "version");

-- CreateIndex
CREATE INDEX "public_page_versions_page_key_status_effective_at_idx" ON "content"."public_page_versions"("page_key", "status", "effective_at");

-- CreateIndex
CREATE INDEX "user_policy_acceptances_user_id_accepted_at_idx" ON "identity"."user_policy_acceptances"("user_id", "accepted_at");

-- CreateIndex
CREATE INDEX "user_policy_acceptances_terms_version_id_idx" ON "identity"."user_policy_acceptances"("terms_version_id");

-- CreateIndex
CREATE INDEX "user_policy_acceptances_privacy_version_id_idx" ON "identity"."user_policy_acceptances"("privacy_version_id");

-- AddForeignKey
ALTER TABLE "identity"."user_policy_acceptances" ADD CONSTRAINT "user_policy_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_policy_acceptances" ADD CONSTRAINT "user_policy_acceptances_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "content"."public_page_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_policy_acceptances" ADD CONSTRAINT "user_policy_acceptances_privacy_version_id_fkey" FOREIGN KEY ("privacy_version_id") REFERENCES "content"."public_page_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
