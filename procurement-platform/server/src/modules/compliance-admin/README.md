# Compliance Admin Module

Database-backed platform administration APIs for ProcureX admin screens.

## Auth

All routes except `GET /api/compliance-admin` and `GET /api/compliance-admin/status` require:

```http
Authorization: Bearer <session-token>
```

The token must resolve to an active, unexpired session whose user has `accountType = ADMIN`.

## Endpoints

- `GET /api/compliance-admin/apps` returns the admin app registry used by the dashboard, sidebar, and app drawer. Each entry includes route metadata, backend association, live status, and `generatedAt`.
- `GET /api/compliance-admin/dashboard` returns platform counts, risk summary, open compliance cases, and recent admin actions.
- `GET /api/compliance-admin/users?page=&pageSize=&q=&verificationStatus=&accountType=&role=` returns admin user rows with default organization, capabilities, trust/risk, screening, and last session.
- `GET /api/compliance-admin/search?q=&type=&status=&stage=&from=&to=&minAmount=&maxAmount=&flagged=&evaluations=&documents=&audit=&page=&pageSize=` searches users, organizations, tenders, bids, contracts, documents, evaluations, awards, compliance cases, audit events, and records.
- `GET /api/compliance-admin/compliance/cases?status=&severity=&page=&pageSize=` lists compliance cases.
- `PATCH /api/compliance-admin/compliance/cases/:id` updates case `status`, `severity`, `owner`, or `payload`.
- `GET /api/compliance-admin/compliance/rules?status=&severity=&page=&pageSize=` lists compliance rules.
- `POST /api/compliance-admin/compliance/rules` creates a compliance rule.
- `PATCH /api/compliance-admin/compliance/rules/:id` updates a compliance rule.
- `GET /api/compliance-admin/audit/events?eventType=&severity=&actorRole=&entityType=&q=&from=&to=&page=&pageSize=` lists read-only audit events.
- `GET /api/compliance-admin/analytics?from=&to=` returns aggregate admin analytics with platform value, procurement mix, organization rankings, and compliance trends.
- `GET /api/compliance-admin/datastore/namespaces?scope=&q=` lists data store namespaces by scope.
- `GET /api/compliance-admin/datastore/entries?scope=&namespace=&ownerUserId=&q=&page=&pageSize=` lists namespace/key JSON entries. Search accepts `namespace#key` and `#key`.
- `GET /api/compliance-admin/datastore/entries/:id` returns one data store entry.
- `POST /api/compliance-admin/datastore/entries` creates a `GLOBAL` or `USER` scoped JSON entry.
- `PATCH /api/compliance-admin/datastore/entries/:id` updates namespace, key, JSON value, or encrypted flag.
- `DELETE /api/compliance-admin/datastore/entries/:id` deletes an entry when body is `{ "confirm": "DELETE" }`.
- `GET /api/compliance-admin/datastore/entries/export` exports filtered entries and records an admin export action.
- `POST /api/compliance-admin/actions` records an admin action and matching audit event.

## Admin App Registry

`GET /api/compliance-admin/apps` exposes the live admin app list:

- Command Center -> `/admin`, backed by `/api/compliance-admin/dashboard`
- User Management -> `/admin/users`, backed by `/api/compliance-admin/users` and identity verification admin APIs
- Platform Analytics -> `/admin/analytics`, backed by `/api/compliance-admin/analytics`
- Full Audit Trail -> `/admin/audit`, backed by `/api/compliance-admin/audit/events`
- Tender Review -> `/admin/tender-review`, backed by procurement admin tender review APIs
- Communication Center -> `/admin/communication`, backed by the communication module
- Admin Profile -> `/admin/profile`, backed by identity profile APIs

The app registry is static metadata enriched with the request timestamp. Data counts and status hints are loaded from the relevant live endpoints in the React admin pages.

## Database

The module uses the shared Prisma client and `DATABASE_URL` from `.env`. Compliance rules live in `compliance.compliance_rules`, with row-level security allowing platform admins or same-organization access.
