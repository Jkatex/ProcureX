-- Backfill real non-admin user organizations so every user account can act as both buyer and supplier.
-- Demo datasets keep their role-specific capabilities for scenario testing.

WITH target_organizations AS (
  SELECT DISTINCT o.id
  FROM "organization"."organizations" o
  JOIN "organization"."organization_members" om ON om."organization_id" = o.id
  JOIN "identity"."users" u ON u.id = om."user_id"
  WHERE om."status" = 'ACTIVE'
    AND u."account_type" = 'USER'
    AND o."kind" <> 'PLATFORM'
    AND COALESCE(o."metadata" ->> 'demoAccount', 'false') <> 'true'
    AND NOT (o."metadata" ? 'demoDataset')
)
UPDATE "organization"."organization_capabilities" oc
SET "enabled" = true
FROM target_organizations t
WHERE oc."organization_id" = t.id
  AND oc."capability" IN ('BUYER'::"organization"."OrganizationCapabilityName", 'SUPPLIER'::"organization"."OrganizationCapabilityName");

WITH target_organizations AS (
  SELECT DISTINCT o.id
  FROM "organization"."organizations" o
  JOIN "organization"."organization_members" om ON om."organization_id" = o.id
  JOIN "identity"."users" u ON u.id = om."user_id"
  WHERE om."status" = 'ACTIVE'
    AND u."account_type" = 'USER'
    AND o."kind" <> 'PLATFORM'
    AND COALESCE(o."metadata" ->> 'demoAccount', 'false') <> 'true'
    AND NOT (o."metadata" ? 'demoDataset')
)
INSERT INTO "organization"."organization_capabilities" ("id", "organization_id", "capability", "enabled", "created_at")
SELECT gen_random_uuid(), t.id, capability."name", true, CURRENT_TIMESTAMP
FROM target_organizations t
CROSS JOIN (
  VALUES
    ('BUYER'::"organization"."OrganizationCapabilityName"),
    ('SUPPLIER'::"organization"."OrganizationCapabilityName")
) AS capability("name")
ON CONFLICT ("organization_id", "capability") DO NOTHING;

WITH target_organizations AS (
  SELECT DISTINCT o.id
  FROM "organization"."organizations" o
  JOIN "organization"."organization_members" om ON om."organization_id" = o.id
  JOIN "identity"."users" u ON u.id = om."user_id"
  WHERE om."status" = 'ACTIVE'
    AND u."account_type" = 'USER'
    AND o."kind" <> 'PLATFORM'
    AND COALESCE(o."metadata" ->> 'demoAccount', 'false') <> 'true'
    AND NOT (o."metadata" ? 'demoDataset')
)
INSERT INTO "organization"."buyer_profiles" ("id", "organization_id", "procuring_type", "budget_code", "payload", "created_at")
SELECT
  gen_random_uuid(),
  t.id,
  'Verified ProcureX buyer',
  NULL,
  '{"backfilledDualCapability": true}'::jsonb,
  CURRENT_TIMESTAMP
FROM target_organizations t
ON CONFLICT ("organization_id") DO NOTHING;

WITH target_organizations AS (
  SELECT DISTINCT o.id
  FROM "organization"."organizations" o
  JOIN "organization"."organization_members" om ON om."organization_id" = o.id
  JOIN "identity"."users" u ON u.id = om."user_id"
  WHERE om."status" = 'ACTIVE'
    AND u."account_type" = 'USER'
    AND o."kind" <> 'PLATFORM'
    AND COALESCE(o."metadata" ->> 'demoAccount', 'false') <> 'true'
    AND NOT (o."metadata" ? 'demoDataset')
)
INSERT INTO "organization"."supplier_profiles" ("id", "organization_id", "trust_tier", "risk_level", "categories", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  t.id,
  'UNVERIFIED'::"organization"."TrustTier",
  'MEDIUM'::"organization"."RiskLevel",
  '[]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM target_organizations t
ON CONFLICT ("organization_id") DO NOTHING;
