CREATE UNIQUE INDEX IF NOT EXISTS bids_active_supplier_tender_unique
ON bidding.bids (tender_id, supplier_org_id)
WHERE status <> 'WITHDRAWN';
