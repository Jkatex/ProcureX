# ProcureX System Implementation Guide

ProcureX is implemented as a modular procurement platform that turns the
original `procurex-ui` prototype into a production-ready system. This document
explains the implementation end to end, from the user-facing workflows to the
React client, Express backend, Prisma data model, database security, and
operational tooling.

The screenshots in this document come from the original ProcureX reference UI:

```text
docs/ui-parity/screenshots/desktop/reference/
```

The reference UI remains the visual and workflow source of truth. The production
system lives in `procurement-platform`, where the client, server, shared
contracts, database, tests, and scripts are maintained.

No public API or schema changes are introduced by this document. This is a
documentation and screenshot-embedding update only.

## 1. Platform Overview

ProcureX is organized around the full procurement lifecycle: public discovery,
account registration, company verification, tender creation, supplier bidding,
bid evaluation, award recommendation, contract negotiation, post-award tracking,
communication, records, and platform administration.

![ProcureX welcome screen](ui-parity/screenshots/desktop/reference/welcome.png)

### What This Implements

The platform implements a multi-sided procurement workspace with three major
operating surfaces:

- Public and guest surfaces for discovery, registration, sign-in, policy pages,
  and marketplace previews.
- Authenticated organization workspaces for buyers, suppliers, evaluators,
  approvers, and company users.
- Administrative surfaces for platform compliance, verification review, audit,
  user management, analytics, and search.

### How It Is Wired

The monorepo is the production source of truth:

```text
procurement-platform/
|-- client/       # React, Vite, MUI, Redux Toolkit, routing, UI pages
|-- server/       # Express, Prisma, API modules, database access, tests
|-- shared/       # Shared contracts and enums
|-- ml-service/   # Reserved for future Python intelligence workloads
|-- docker/       # Local infrastructure documentation
|-- docs/         # Architecture, database, UI parity, implementation docs
|-- scripts/      # Generation and screenshot capture scripts
`-- package.json  # Workspace scripts
```

The sibling `../procurex-ui` folder is the static prototype. It is not served by
the production React client. Instead, it is used as the design and workflow
reference for generated and maintained React pages under:

```text
client/src/features/*/components/procurex/
```

## 2. UI Reference And Production Parity

ProcureX keeps a deliberate separation between design reference and production
implementation.

![Guest marketplace](ui-parity/screenshots/desktop/reference/guest-marketplace.png)

### What This Implements

The static `procurex-ui` project captures the product experience, page order,
card layout, section wording, and visual structure. The React client implements
the same experience in the production app so it can use routing, auth guards,
state management, localization, API integration, and tests.

This gives the team a stable migration path:

- Keep the prototype as a visual baseline.
- Generate or maintain production React components from that baseline.
- Capture screenshots of both the prototype and React target.
- Compare visible behavior as pages are migrated and improved.

### How It Is Wired

The UI parity documentation and scripts live in:

```text
docs/ui-parity/
scripts/capture-ui-parity.mjs
scripts/generate-client-procurex-pages.mjs
```

The screenshot capture script opens two versions of each page:

- the reference prototype, through `../procurex-ui/index.html?page=...`
- the React target route, through the Vite client, such as `/dashboard`

Reference screenshots are saved under:

```text
docs/ui-parity/screenshots/desktop/reference/
docs/ui-parity/screenshots/mobile/reference/
```

Target screenshots are saved under:

```text
docs/ui-parity/screenshots/desktop/target/
docs/ui-parity/screenshots/mobile/target/
```

The route mapping used by the capture process lives in:

```text
docs/ui-parity/routes.json
```

## 3. Frontend Implementation

The production frontend is a React 19 and Vite application. It uses MUI for the
component foundation, Redux Toolkit for feature state, React Router for
navigation, i18next for localization, Recharts for charts, and Axios for API
communication.

![App launcher](ui-parity/screenshots/desktop/reference/app-launcher.png)

### What This Implements

The frontend implements the visible ProcureX workflows as feature slices. Each
major domain has pages, components, fixtures, hooks, API helpers, and state where
needed. The generated ProcureX pages preserve prototype wording and structure,
while feature-specific components can add richer behavior over time.

Important frontend areas include:

- `src/app` for application setup, routing, providers, route guards, and legacy
  redirects.
- `src/features` for procurement, bidding, evaluation, awards, identity,
  records, communication, admin, public, auth, and workspace experiences.
- `src/shared` for reusable components, API utilities, formatting, hooks, and
  domain types.
- `src/i18n` for English and Swahili localization resources.
- `src/styles` for global styles, ProcureX prototype compatibility, tokens, and
  MUI theme configuration.

### How It Is Wired

The frontend entrypoint is `client/src/main.tsx`, which renders the application
through the app providers and router. Routing is defined in:

```text
client/src/app/router.tsx
```

The router uses a `procurexPageRegistry` so prototype-derived pages can be
addressed by stable keys:

```text
client/src/features/procurexPageRegistry.tsx
```

The registry imports each production React page and exposes a page-key map. The
router then chooses whether a route is public, authenticated, verified, or admin
only.

Examples:

- `/` renders the public home or legacy page handler.
- `/sign-in` renders the sign-in page.
- `/dashboard` requires a verified authenticated session.
- `/procurement/create-tender` requires a verified authenticated session.
- `/admin` requires an administrator session.

The route guard layer keeps product rules out of individual pages. Public pages
can remain simple, while sensitive workspaces are wrapped by `ProtectedRoute`,
`AdminRoute`, or verified-session helpers.

## 4. Public Entry Experience

Public pages introduce ProcureX, show marketplace opportunities, and route users
into registration or sign-in.

![Public marketplace](ui-parity/screenshots/desktop/reference/guest-marketplace.png)

### What This Implements

The public entry experience supports:

- landing and orientation content
- guest marketplace exploration
- public contact and information pages
- privacy and terms pages
- registration and sign-in entry points

These pages let suppliers and buyers understand the system before creating an
account, while preserving a clean path into authenticated workflows.

### How It Is Wired

Public page components live under:

```text
client/src/features/public/components/procurex/
```

They are registered in the page registry and routed without a protected wrapper.
The public shell and shared visual components are kept separate from
authenticated app shell components so public pages do not inherit workspace-only
navigation or session assumptions.

## 5. Authentication And Identity

Identity is the foundation of all protected ProcureX behavior. The platform
separates account type from procurement capability. A user account is either
`USER` or `ADMIN`; buyer and supplier behavior comes from organization
capabilities, not login roles.

![Registration screen](ui-parity/screenshots/desktop/reference/register.png)

![Sign-in screen](ui-parity/screenshots/desktop/reference/sign-in.png)

### What This Implements

The identity implementation supports:

- registration start
- OTP verification
- email activation
- password setup
- sign-in
- forgot-password and reset-password flow
- session lookup
- sign-out
- company verification profile draft and submission
- admin verification review and decision

![Identity verification](ui-parity/screenshots/desktop/reference/iam-verification.png)

![Verification status](ui-parity/screenshots/desktop/reference/verification-status.png)

### How It Is Wired

The identity backend module is mounted at:

```text
/api/identity
```

The identity routes include:

```text
POST /api/identity/registration/start
POST /api/identity/registration/verify-otp
POST /api/identity/registration/activate-email
POST /api/identity/registration/set-password
POST /api/identity/auth/sign-in
POST /api/identity/auth/forgot-password
POST /api/identity/auth/reset-password
GET  /api/identity/session
POST /api/identity/auth/sign-out
GET  /api/identity/verification/me
POST /api/identity/verification/registry-lookup
PUT  /api/identity/verification/draft
POST /api/identity/verification/submit
PUT  /api/identity/profile
GET  /api/identity/admin/verifications
POST /api/identity/admin/verifications/:id/decision
```

The client uses the session endpoint to decide whether a user can access
protected pages. For UI parity screenshot capture, the script mocks the session
endpoint so authenticated pages can be rendered consistently without a live
login.

## 6. Workspace And Navigation Model

After verification, users enter a workspace that gives them access to modules
based on account type, organization capability, and workflow context.

![Workspace dashboard](ui-parity/screenshots/desktop/reference/workspace-dashboard.png)

### What This Implements

The workspace implements the operational command center for ProcureX users. It
summarizes current activity and links into procurement, bidding, evaluation,
awards, communication, records, and administration where permitted.

The app launcher gives the user a module-oriented view of the system:

![Application launcher](ui-parity/screenshots/desktop/reference/app-launcher.png)

### How It Is Wired

Workspace components live under:

```text
client/src/features/workspace/
```

The workspace pages are protected by route guards. This means a user can reach
public pages without a session, identity pages with an authenticated but
unverified session, and operational workspace pages only after verification.

The navigation model is intentionally client-side, but the backend remains the
authority for session and verification state.

## 7. Procurement Lifecycle

Procurement is the central workflow. Buyers create and publish tenders,
suppliers discover opportunities, documents and requirements are managed, and
published opportunities move into bidding and evaluation.

![Supplier marketplace](ui-parity/screenshots/desktop/reference/supplier-marketplace.png)

### What This Implements

The procurement module implements:

- marketplace discovery
- buyer tender creation
- tender publication
- tender details
- tender document handling
- supplier tender detail views
- procurement guide and journey pages

![Create tender](ui-parity/screenshots/desktop/reference/create-tender.png)

![Tender publication](ui-parity/screenshots/desktop/reference/tender-publication.png)

![Tender details](ui-parity/screenshots/desktop/reference/tender-details.png)

![Tender document](ui-parity/screenshots/desktop/reference/tender-document.png)

### How It Is Wired

The procurement frontend lives under:

```text
client/src/features/procurement/
```

The backend procurement module is mounted at:

```text
/api/procurement
```

The Prisma model represents procurement through `Tender`, `TenderCategory`,
`TenderDocument`, `TenderRequirement`, `TenderMilestone`, and
`TenderCommercialItem`. Tender ownership is expressed through `buyerOrgId`,
which connects a tender to the buying organization rather than to a personal
login role.

This matters because ProcureX treats buyer behavior as an organization
capability. A normal `USER` account belongs to a company, and that company can
act as a buyer, supplier, or both.

## 8. Bidding Workspace

The bidding workspace is where suppliers prepare, manage, and submit responses
to tender opportunities.

![Bidding workspace](ui-parity/screenshots/desktop/reference/bidding-workspace.png)

### What This Implements

The bidding implementation supports the supplier side of tender response:

- bid workspace views
- bid status tracking
- bid versions
- bid documents
- bid responses
- bid receipts
- supplier and buyer organization linkage

### How It Is Wired

The bidding frontend lives under:

```text
client/src/features/bidding/
```

The bidding backend module is mounted at:

```text
/api/bidding
```

The database represents bids with `Bid`, `BidVersion`, `BidDocument`,
`BidResponse`, and `BidReceipt`. Bid ownership includes both `buyerOrgId` and
`supplierOrgId`, so access rules can reason about both sides of the transaction.

## 9. Evaluation Workflow

Evaluation turns submitted bids into structured scoring, review, and award
recommendation decisions.

![Bid evaluation](ui-parity/screenshots/desktop/reference/bid-evaluation.png)

### What This Implements

The evaluation implementation supports:

- evaluation workspaces
- workflow assignments
- evaluation criteria
- evaluation scores
- evaluation stages
- approval and recommendation handoff

### How It Is Wired

The evaluation frontend lives under:

```text
client/src/features/evaluation/
```

The evaluation backend module is mounted at:

```text
/api/evaluation
```

The database models this area through `EvaluationWorkspace`,
`WorkflowAssignment`, `EvaluationCriterion`, and `EvaluationScore`. Permission
decisions are based on workflow assignments and database access rules, not broad
buyer or supplier login roles.

## 10. Awards And Contracts

The awards and contracts area converts evaluation outcomes into award
recommendations, approvals, contracts, purchase orders, invoices, and post-award
tracking.

![Awarding contracts](ui-parity/screenshots/desktop/reference/awarding-contracts.png)

### What This Implements

The awards and contracts implementation supports:

- award recommendation
- approval steps
- contract creation and versioning
- supplier award response
- contract negotiation
- purchase order tracking
- invoice and post-award tracking

![Award recommendation](ui-parity/screenshots/desktop/reference/award-recommendation.png)

![Contract negotiation](ui-parity/screenshots/desktop/reference/contract-negotiation.png)

![Post-award tracking](ui-parity/screenshots/desktop/reference/post-award-tracking.png)

### How It Is Wired

The awards frontend lives under:

```text
client/src/features/awardsContracts/
```

The backend module is mounted at:

```text
/api/award-contract
```

The database represents the award and contract lifecycle with
`AwardRecommendation`, `ApprovalStep`, `Contract`, `ContractVersion`,
`PurchaseOrder`, and `Invoice`.

The frontend routes map the lifecycle into distinct screens:

- `/awards-contracts`
- `/awards-contracts/recommendation`
- `/awards-contracts/negotiation`
- `/awards-contracts/post-award`

## 11. Communication And Records

Communication and records provide traceability. Procurement systems need a clear
history of decisions, documents, conversations, approvals, and operational
events.

![Communication center](ui-parity/screenshots/desktop/reference/communication-center.png)

### What This Implements

The communication center supports structured messages and workflow-related
updates. Records provide a history surface for auditable procurement activity.

![Records history](ui-parity/screenshots/desktop/reference/records-history.png)

### How It Is Wired

The communication frontend lives under:

```text
client/src/features/communication/
```

The records frontend lives under:

```text
client/src/features/records/
```

The backend modules are mounted at:

```text
/api/communication
/api/records
```

The database represents this area with `CommunicationItem`,
`CommunicationAttachment`, `RecordEntry`, and `AuditEvent`. Together, these
models support timeline-style user communication and system-level traceability.

## 12. Admin And Compliance

Admin users are platform compliance users. They are not buyer or supplier
operators. Their job is to oversee verification, compliance, audit, search,
analytics, and platform-level actions.

![Admin dashboard](ui-parity/screenshots/desktop/reference/admin-dashboard.png)

### What This Implements

The admin implementation supports:

- platform dashboard
- global search
- user and organization review
- compliance case handling
- analytics
- audit review
- verification decision workflows

![Admin search](ui-parity/screenshots/desktop/reference/admin-search.png)

![Admin users](ui-parity/screenshots/desktop/reference/admin-users.png)

![Admin compliance](ui-parity/screenshots/desktop/reference/admin-compliance.png)

![Admin analytics](ui-parity/screenshots/desktop/reference/admin-analytics.png)

![Admin audit](ui-parity/screenshots/desktop/reference/admin-audit.png)

### How It Is Wired

Admin frontend components live under:

```text
client/src/features/admin/
```

The compliance admin backend module is mounted at:

```text
/api/compliance-admin
```

Admin-only pages are wrapped by `AdminRoute`. This keeps admin-only navigation
and access checks centralized at the router layer. The database supports
administrative work through models such as `ComplianceCase`, `RiskSignal`,
`AdminAction`, and `AuditEvent`.

## 13. Backend Module Architecture

The backend is a TypeScript Express application. It is designed around module
boundaries so each product area has a predictable implementation shape.

### What This Implements

Each backend module follows the same structure:

```text
routes.ts -> controller.ts -> service.ts -> repository.ts -> validators.ts -> types.ts
```

The responsibilities are:

- `routes.ts` defines HTTP endpoints and maps them to controller handlers.
- `controller.ts` handles HTTP request and response concerns.
- `service.ts` owns business behavior and orchestration.
- `repository.ts` owns persistence and external data access.
- `validators.ts` owns request validation.
- `types.ts` owns module-local contracts and module metadata.

### How It Is Wired

The Express app is created in:

```text
server/src/app.ts
```

The app configures CORS, JSON parsing, health checks, registered module routing,
404 handling, and centralized error handling.

Modules are registered in:

```text
server/src/modules/index.ts
```

Registered API base paths:

```text
/api/identity
/api/organization
/api/procurement
/api/bidding
/api/evaluation
/api/award-contract
/api/financial
/api/compliance-admin
/api/communication
/api/records
/api/intelligence
/api/integration
/api/documents
```

The `/health` endpoint returns service status and the registered modules. This
makes it useful for quick operational checks and test assertions.

## 14. Shared Contracts

The `shared` workspace holds cross-cutting contracts that both client and server
can use.

### What This Implements

The current shared contract surface captures core account and organization
rules:

```text
accountTypes = USER | ADMIN
organizationCapabilities = BUYER | SUPPLIER
```

This supports the central ProcureX identity rule: login account type is not the
same thing as procurement role. Procurement behavior is attached to the
organization and workflow context.

### How It Is Wired

The shared workspace is included in the root package workspaces. Root build
scripts build shared contracts before server and client builds:

```text
npm run build
```

That command runs the shared build first, then the server build, then the client
build.

## 15. Database And Prisma Foundation

The database layer uses Prisma as the application model and migration source.
The schema lives in:

```text
server/prisma/schema.prisma
```

### What This Implements

The schema models the major ProcureX domains:

- identity and sessions
- verification and company profiles
- organizations, members, and capabilities
- tenders and tender documents
- bids and bid responses
- evaluation workspaces and scoring
- award recommendations and approvals
- contracts, purchase orders, and invoices
- documents, audit events, compliance cases, and risk signals
- communication and records
- market intelligence and integration records

### How It Is Wired

Core database rules:

- Accounts are only `USER` or `ADMIN`.
- A normal user belongs to a company through `OrganizationMember`.
- A company can act as buyer, supplier, or both through
  `OrganizationCapability`.
- Optional buyer and supplier profiles belong to the same `Organization`.
- Tender ownership uses `buyerOrgId`.
- Bid ownership uses both `buyerOrgId` and `supplierOrgId`.
- Evaluation permissions use workflow assignments and RLS-aware access, not
  broad identity roles.

The first migration and RLS SQL live under:

```text
server/prisma/migrations/
server/prisma/sql/rls/
```

## 16. Row-Level Security And Access Context

ProcureX is designed for organization-aware access. Database access must respect
the current account, organization, and workflow assignment context.

### What This Implements

Row-level security protects sensitive procurement data at the database layer.
The application can apply request context before database work so the database
can enforce access rules consistently.

Important RLS source files:

```text
server/prisma/sql/rls/001_app_context.sql
server/prisma/sql/rls/002_enable_rls.sql
```

### How It Is Wired

The database context utilities live under:

```text
server/src/db/
```

RLS verification is available through:

```text
npm --workspace server run verify:rls
```

This confirms that seeded organizations and users cannot read or mutate data
outside their allowed context.

## 17. Intelligence, Integration, Documents, And Financial Modules

Several modules prepare ProcureX for future production expansion even where the
current implementation is intentionally skeletal.

### What This Implements

These modules provide stable backend boundaries for:

- intelligence workloads, supplier matching, benchmarks, and risk signals
- external system integrations and registry records
- document object handling
- financial purchase order and invoice workflows

### How It Is Wired

The backend modules are already registered at:

```text
/api/intelligence
/api/integration
/api/documents
/api/financial
```

The `ml-service` folder is reserved for future Python or FastAPI intelligence
workloads. It is intentionally separate from the TypeScript API so machine
learning and scoring work can evolve without forcing changes into the core
Express server.

## 18. Development Workflow

The root workspace provides standard scripts for local development, database
setup, testing, and builds.

### What This Implements

Development is designed around a root workspace with child workspaces for the
client, server, and shared contracts. The typical local flow is:

```powershell
cd procurement-platform
npm install
Copy-Item server/.env.example server/.env
npm run infra:up
npm run db:validate
npm run db:migrate
npm run db:seed:twice
npm test
```

### How It Is Wired

Important root scripts:

```text
npm run dev
npm run dev:client
npm run build
npm run build:client
npm test
npm run test:client
npm run lint:client
npm run infra:up
npm run infra:down
npm run db:validate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:seed:twice
```

The React client can be started with:

```powershell
npm run dev:client
```

The server can be started with:

```powershell
npm run dev
```

## 19. Screenshot Capture Workflow

Screenshots are an implementation asset, not only a documentation asset. They
help the team confirm that production React pages preserve the reference UI.

### What This Implements

The screenshot workflow captures desktop and mobile viewports for both the
reference prototype and production React target. This gives maintainers a visual
audit trail while migrating from prototype to production.

### How It Is Wired

Start the React client:

```powershell
npm run dev:client
```

Capture screenshots:

```powershell
npm --workspace client run ui:parity:screenshots
```

The capture script:

- reads page mappings from `docs/ui-parity/routes.json`
- opens the reference UI from `../procurex-ui/index.html?page=...`
- opens the production route from the Vite client
- injects a mock authenticated session for protected routes
- saves desktop and mobile screenshots into `docs/ui-parity/screenshots/`

## 20. Testing Strategy

ProcureX uses targeted server and client tests to protect core behavior.

### What This Implements

Current test coverage includes:

- backend app and module validation tests
- identity development bypass tests
- React route guard tests
- React page smoke tests
- shared component tests
- awards and contracts flow tests
- ProcureX static page tests
- language and layout checks

### How It Is Wired

Root test command:

```powershell
npm test
```

Client-only tests:

```powershell
npm run test:client
```

Client lint:

```powershell
npm run lint:client
```

Database RLS verification:

```powershell
npm --workspace server run verify:rls
```

## 21. Implementation Boundaries

ProcureX has clear boundaries that should be preserved as the system grows.

### Frontend Boundary

The React client owns production UI behavior. It can preserve prototype wording
and layout, but it should not serve files directly from `../procurex-ui`.

### Backend Boundary

Each Express module owns one domain boundary. Shared concerns such as app setup,
database context, module registration, and centralized errors remain outside
individual modules.

### Database Boundary

The Prisma schema is the source of model truth. RLS SQL extends that model with
database-level access enforcement.

### Product Boundary

Identity account type remains separate from buyer and supplier capabilities.
This avoids hard-coding procurement behavior into login roles and allows one
company to act as buyer, supplier, or both.

## 22. Final Implementation Snapshot

ProcureX currently implements the foundation of a production procurement system:

- A React production client with ProcureX reference UI parity.
- An Express backend with registered domain modules.
- A Prisma schema covering the procurement lifecycle.
- Organization-aware identity and capability modeling.
- Database RLS foundations.
- Public, authenticated, verified, and admin routing surfaces.
- Screenshot capture for prototype and production UI comparison.
- Workspace scripts for development, build, testing, database setup, and UI
  parity verification.

The result is a system that can keep the visual quality of the original
ProcureX prototype while moving toward a production-grade architecture with
clear ownership, testable modules, and secure organization-aware workflows.
