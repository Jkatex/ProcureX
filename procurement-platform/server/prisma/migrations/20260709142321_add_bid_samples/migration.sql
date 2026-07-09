-- CreateEnum
CREATE TYPE "bidding"."BidSampleStatus" AS ENUM ('REQUIRED', 'PENDING_SUBMISSION', 'SUBMITTED', 'RECEIVED', 'INSPECTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "bidding"."bid_samples" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "supplier_org_id" UUID NOT NULL,
    "sample_name" TEXT NOT NULL,
    "related_item" TEXT,
    "quantity" DECIMAL(18,2),
    "delivery_location" TEXT,
    "delivery_deadline" TIMESTAMP(3),
    "tracking_status" "bidding"."BidSampleStatus" NOT NULL DEFAULT 'REQUIRED',
    "courier" TEXT,
    "tracking_number" TEXT,
    "submitted_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "inspected_at" TIMESTAMP(3),
    "inspection_notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bid_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bid_samples_bid_id_idx" ON "bidding"."bid_samples"("bid_id");

-- CreateIndex
CREATE INDEX "bid_samples_tender_id_idx" ON "bidding"."bid_samples"("tender_id");

-- CreateIndex
CREATE INDEX "bid_samples_supplier_org_id_idx" ON "bidding"."bid_samples"("supplier_org_id");

-- CreateIndex
CREATE INDEX "bid_samples_tracking_status_idx" ON "bidding"."bid_samples"("tracking_status");

-- AddForeignKey
ALTER TABLE "bidding"."bid_samples" ADD CONSTRAINT "bid_samples_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bidding"."bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_samples" ADD CONSTRAINT "bid_samples_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "procurement"."tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidding"."bid_samples" ADD CONSTRAINT "bid_samples_supplier_org_id_fkey" FOREIGN KEY ("supplier_org_id") REFERENCES "organization"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
