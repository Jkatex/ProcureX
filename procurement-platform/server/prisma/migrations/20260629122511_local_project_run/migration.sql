-- AlterTable
ALTER TABLE "compliance"."admin_actions" ALTER COLUMN "reverted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "compliance"."compliance_rules" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "content"."data_store_entries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "content"."data_store_entry_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "identity"."digital_signatures" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity"."identity_challenges" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity"."screening_checks" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity"."signing_credentials" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity"."verification_profile_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "integration"."registry_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization"."permission_overrides" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization"."trust_tier_history" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "identity"."verification_profile_history_verification_profile_id_created_at" RENAME TO "verification_profile_history_verification_profile_id_create_idx";
