-- Official document templates and immutable generated versions.

CREATE TABLE "documents"."official_document_templates" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "document_type" TEXT NOT NULL,
  "procurement_type" TEXT,
  "jurisdiction" TEXT NOT NULL DEFAULT 'TZ',
  "language" TEXT NOT NULL DEFAULT 'en',
  "version" TEXT NOT NULL DEFAULT '1.0',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source_authority" TEXT NOT NULL DEFAULT 'PPRA',
  "source_url" TEXT,
  "sections" JSONB NOT NULL DEFAULT '[]',
  "required_fields" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "official_document_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents"."official_document_versions" (
  "id" UUID NOT NULL,
  "template_id" UUID,
  "document_object_id" UUID,
  "owner_org_id" UUID,
  "generated_by_user_id" UUID,
  "source_module" TEXT NOT NULL,
  "source_entity_type" TEXT NOT NULL,
  "source_entity_id" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "procurement_type" TEXT,
  "title" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "version_no" INTEGER NOT NULL,
  "template_version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "content_hash" TEXT NOT NULL,
  "pdf_object_key" TEXT NOT NULL,
  "pdf_content_type" TEXT NOT NULL DEFAULT 'application/pdf',
  "pdf_size_bytes" INTEGER NOT NULL DEFAULT 0,
  "validation_warnings" JSONB NOT NULL DEFAULT '[]',
  "approval_metadata" JSONB NOT NULL DEFAULT '{}',
  "signature_metadata" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "official_at" TIMESTAMP(3),
  "voided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "official_document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_document_templates_code_key" ON "documents"."official_document_templates"("code");
CREATE INDEX "official_document_templates_document_type_procurement_type_idx" ON "documents"."official_document_templates"("document_type", "procurement_type");
CREATE INDEX "official_document_templates_status_idx" ON "documents"."official_document_templates"("status");

CREATE UNIQUE INDEX "official_document_versions_source_version_key" ON "documents"."official_document_versions"("source_module", "source_entity_type", "source_entity_id", "document_type", "version_no");
CREATE INDEX "official_document_versions_template_id_idx" ON "documents"."official_document_versions"("template_id");
CREATE INDEX "official_document_versions_document_object_id_idx" ON "documents"."official_document_versions"("document_object_id");
CREATE INDEX "official_document_versions_owner_org_id_status_idx" ON "documents"."official_document_versions"("owner_org_id", "status");
CREATE INDEX "official_document_versions_source_idx" ON "documents"."official_document_versions"("source_module", "source_entity_type", "source_entity_id");
CREATE INDEX "official_document_versions_content_hash_idx" ON "documents"."official_document_versions"("content_hash");

ALTER TABLE "documents"."official_document_versions"
  ADD CONSTRAINT "official_document_versions_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "documents"."official_document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"."official_document_versions"
  ADD CONSTRAINT "official_document_versions_document_object_id_fkey"
  FOREIGN KEY ("document_object_id") REFERENCES "documents"."document_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"."official_document_versions"
  ADD CONSTRAINT "official_document_versions_owner_org_id_fkey"
  FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"."official_document_versions"
  ADD CONSTRAINT "official_document_versions_generated_by_user_id_fkey"
  FOREIGN KEY ("generated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
