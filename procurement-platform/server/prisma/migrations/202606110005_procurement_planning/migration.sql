-- CreateTable
CREATE TABLE "procurement"."procurement_plans" (
    "id" UUID NOT NULL,
    "owner_org_id" UUID NOT NULL,
    "financial_year" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement"."procurement_plan_lines" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "tender_id" UUID,
    "tender_title" TEXT NOT NULL,
    "opening_date" TIMESTAMP(3),
    "closing_date" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "budget" DECIMAL(18,2),
    "procurement_method" TEXT NOT NULL,
    "source_of_funds" TEXT NOT NULL,
    "expected_completion_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Draft planning',
    "plan_state" TEXT NOT NULL DEFAULT 'Not started',
    "notes" TEXT,
    "custom_values" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_plans_owner_org_id_financial_year_name_key" ON "procurement"."procurement_plans"("owner_org_id", "financial_year", "name");

-- CreateIndex
CREATE INDEX "procurement_plans_owner_org_id_financial_year_idx" ON "procurement"."procurement_plans"("owner_org_id", "financial_year");

-- CreateIndex
CREATE INDEX "procurement_plan_lines_plan_id_idx" ON "procurement"."procurement_plan_lines"("plan_id");

-- CreateIndex
CREATE INDEX "procurement_plan_lines_tender_id_idx" ON "procurement"."procurement_plan_lines"("tender_id");

-- CreateIndex
CREATE INDEX "procurement_plan_lines_category_idx" ON "procurement"."procurement_plan_lines"("category");

-- CreateIndex
CREATE INDEX "procurement_plan_lines_status_idx" ON "procurement"."procurement_plan_lines"("status");

-- AddForeignKey
ALTER TABLE "procurement"."procurement_plans" ADD CONSTRAINT "procurement_plans_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."procurement_plan_lines" ADD CONSTRAINT "procurement_plan_lines_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "procurement"."procurement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement"."procurement_plan_lines" ADD CONSTRAINT "procurement_plan_lines_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
