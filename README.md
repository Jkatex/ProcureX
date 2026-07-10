<div align="center">
  <img src="procurex-ui/assets/logo.svg" alt="ProcureX logo" width="104">

  # ProcureX

  **A production-grade procurement platform foundation for transparent tendering, supplier trust, bid evaluation, contract awards, and auditable public-sector workflows.**

  ProcureX brings the original static procurement prototype into a full implementation workspace with a React client, TypeScript API, Prisma data model, shared contracts, local infrastructure, UI parity tooling, and an organization-aware security model.

  <br>

  ![Status](https://img.shields.io/badge/status-active%20implementation-008080)
  ![Client](https://img.shields.io/badge/client-React%2019%20%7C%20Vite%20%7C%20TypeScript-1d1d1f)
  ![Server](https://img.shields.io/badge/server-Express%20%7C%20Prisma%20%7C%20PostgreSQL-2f855a)
  ![Infra](https://img.shields.io/badge/infra-Postgres%20%7C%20Redis%20%7C%20Elasticsearch%20%7C%20MinIO-5b5fc7)
  ![License](https://img.shields.io/badge/license-MIT-blue)
</div>

---

## Table Of Contents

- [Preview](#preview)
- [What ProcureX Is](#what-procurex-is)
- [Implementation Snapshot](#implementation-snapshot)
- [Architecture Overview](#architecture-overview)
- [Product Workflows](#product-workflows)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Run Full Project With `.env.example`](#run-full-project-with-envexample)
- [Environment Setup](#environment-setup)
- [Development Commands](#development-commands)
- [Repository Map](#repository-map)
- [Testing And Verification](#testing-and-verification)
- [Documentation Map](#documentation-map)
- [Current Status And Roadmap](#current-status-and-roadmap)
- [License](#license)

## Preview

The production React client is built to preserve visual and workflow parity with the original `procurex-ui` prototype while gaining routing, state, localization, API adapters, tests, and guarded workspace surfaces.

| Welcome | Workspace Dashboard | Create Tender |
| --- | --- | --- |
| ![ProcureX welcome screen](procurement-platform/docs/ui-parity/screenshots/desktop/target/welcome.png) | ![ProcureX workspace dashboard](procurement-platform/docs/ui-parity/screenshots/desktop/target/workspace-dashboard.png) | ![ProcureX create tender workflow](procurement-platform/docs/ui-parity/screenshots/desktop/target/create-tender.png) |

| Supplier Marketplace | Bid Evaluation | Award Recommendation |
| --- | --- | --- |
| ![ProcureX supplier marketplace](procurement-platform/docs/ui-parity/screenshots/desktop/target/supplier-marketplace.png) | ![ProcureX bid evaluation workspace](procurement-platform/docs/ui-parity/screenshots/desktop/target/bid-evaluation.png) | ![ProcureX award recommendation workspace](procurement-platform/docs/ui-parity/screenshots/desktop/target/award-recommendation.png) |

## What ProcureX Is

ProcureX models a complete procurement operating environment for buyers, suppliers, evaluators, approvers, and platform administrators. It replaces scattered tender documents, manual eligibility checks, informal supplier records, disconnected evaluation spreadsheets, and fragile approval trails with one structured lifecycle.

The repository now contains two important layers:

| Layer | Purpose |
| --- | --- |
| `procurement-platform/` | Canonical production implementation workspace: React client, Express backend, Prisma schema, shared contracts, local infrastructure, tests, scripts, and docs. |
| `procurex-ui/` | Static HTML/CSS/JavaScript prototype used as the visual, wording, and workflow reference for the production client. |

The production platform is the source of truth for implementation. The static prototype remains a valuable design reference, not the deployed application architecture.

## Implementation Snapshot

| Area | Current implementation |
| --- | --- |
| Client | React 19, Vite, TypeScript, React Router, Redux Toolkit, MUI, i18next, Axios adapters, Recharts, Vitest, Testing Library. |
| Server | TypeScript Express API with module boundaries, controllers, services, repositories, validators, Prisma, Zod, Helmet, CORS, and Vitest. |
| Database | Prisma schema and migrations for identity, organizations, tenders, bids, evaluation, awards, contracts, records, communication, compliance, documents, intelligence, and integrations. |
| Local infrastructure | Docker Compose for PostgreSQL 16, Redis 7, Elasticsearch 8, and MinIO object storage. |
| Shared contracts | Workspace package for account types and organization capability contracts shared by client and server. |
| UI parity | Screenshot capture and route mapping compare the original static prototype against the production React target. |
| Future expansion | `ml-service/` is reserved for future Python/FastAPI intelligence workloads such as risk, matching, benchmarking, and anomaly detection. |

Core product rules already captured by the implementation:

- Login account type is only `USER` or `ADMIN`.
- Buyer and supplier behavior is an organization capability, not a login role.
- A normal user belongs to a company through organization membership.
- A company can operate as buyer, supplier, or both.
- Evaluator, approver, auditor, and observer behavior is represented through workflow context and assignments.
- Database row-level security foundations are maintained separately from broad UI route checks.

## Architecture Overview

```mermaid
flowchart LR
  Prototype["procurex-ui static prototype"]
  Client["React client<br>Vite + MUI + Redux"]
  Server["Express API<br>modules + services"]
  Shared["shared contracts"]
  Prisma["Prisma schema<br>migrations + seed"]
  Data["PostgreSQL<br>Redis<br>Elasticsearch<br>MinIO"]
  Docs["docs + UI parity screenshots"]

  Prototype -->|"visual and wording reference"| Client
  Client -->|"typed API adapters"| Server
  Client --> Shared
  Server --> Shared
  Server --> Prisma
  Prisma --> Data
  Prototype --> Docs
  Client --> Docs
```

The backend follows a consistent module pattern:

```text
routes.ts -> controller.ts -> service.ts -> repository.ts -> validators.ts -> types.ts
```

Registered API module boundaries include identity, organization, procurement, bidding, evaluation, award-contract, financial, compliance-admin, communication, records, intelligence, integration, and documents.

## Product Workflows

| Workflow | What ProcureX covers |
| --- | --- |
| Public discovery | Welcome, about, contact, policy pages, and guest marketplace entry points. |
| Identity and trust | Registration, OTP/email activation, sign-in, session lookup, profile update, verification draft/submission, and admin verification review. |
| Procurement | Tender creation, publication, tender details, documents, requirements, milestones, commercial items, and supplier-facing tender views. |
| Bidding | Supplier bid workspace, bid versions, bid documents, responses, receipts, and organization-scoped ownership. |
| Evaluation | Evaluation workspaces, criteria, scores, workflow assignments, stages, and award recommendation handoff. |
| Awards and contracts | Award recommendation, approval steps, contract versioning, negotiation, purchase order tracking, invoices, and post-award tracking. |
| Communication and records | Structured communication, attachments, timeline-style records, audit events, and searchable operational history. |
| Administration | Platform dashboard, user and organization review, compliance cases, global search, analytics, audit review, and verification decisions. |

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, React Router, Redux Toolkit, MUI, Emotion, i18next, Recharts, Axios |
| Backend | Node.js, Express, TypeScript, Prisma, Zod, Helmet, CORS, dotenv, Resend, Beem Africa, AWS S3 SDK |
| Data and infra | PostgreSQL 16, Redis 7, Elasticsearch 8, MinIO, Docker Compose |
| Testing | Vitest, React Testing Library, Supertest, Playwright screenshot capture |
| Shared package | TypeScript contracts consumed by client and server workspaces |
| Prototype reference | Static HTML, CSS, JavaScript, Chart.js, html2pdf.js, dotLottie |

## Quick Start

Requirements:

- Node.js `>=20.11`
- npm with workspace support
- Docker Desktop or compatible Docker Engine
- PowerShell on Windows, or an equivalent shell with adjusted copy commands
- Free local ports: `4000`, `5173`, `5432`, `6379`, `9200`, `9000`, and `9001`

## Run Full Project With `.env.example`

From the repository root, install dependencies and start the local infrastructure:

```powershell
cd procurement-platform
npm install
npm run infra:up
npm run db:validate
npm run db:migrate
npm run db:seed
```

Start the backend in terminal 1. This loads `server/.env.example` directly:

```powershell
npm run dev:server:example
```

Start the frontend in terminal 2. This loads `client/.env.example` directly:

```powershell
npm run dev:client:example
```

Open the app:

```text
http://localhost:5173
```

Check the API:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

Copying `.env.example` to `.env` is optional and only needed when you want local values that differ from the tracked examples.

## Environment Setup

The example environment files are designed for local Docker services.

Server defaults:

```env
DATABASE_URL="postgresql://procurex:procurex@localhost:5432/procurex"
DIRECT_URL="postgresql://procurex:procurex@localhost:5432/procurex"
REDIS_URL="redis://localhost:6379"
ELASTICSEARCH_URL="http://localhost:9200"
S3_ENDPOINT="http://localhost:9000"
S3_DOCUMENT_BUCKET="procurex-documents"
PORT="4000"
```

Client defaults:

```env
VITE_API_BASE_URL="http://localhost:4000"
VITE_DEMO_SIGN_IN_ENABLED="false"
```

Local services started by `npm run infra:up`:

| Service | URL / port |
| --- | --- |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Elasticsearch | `http://localhost:9200` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |

## Development Commands

Run these from `procurement-platform/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Express backend in watch mode. |
| `npm run dev:client` | Start the Vite React client. |
| `npm run build` | Build shared contracts, server, and client. |
| `npm run build:client` | Build shared contracts and the client only. |
| `npm test` | Run server and client tests. |
| `npm run test:client` | Run client tests only. |
| `npm run lint:client` | Run client ESLint checks. |
| `npm run infra:up` | Start local Docker services. |
| `npm run infra:down` | Stop local Docker services. |
| `npm run db:validate` | Validate the Prisma schema. |
| `npm run db:migrate` | Run local Prisma migrations. |
| `npm run db:deploy` | Deploy migrations in a non-dev flow. |
| `npm run db:seed` | Seed local data once. |
| `npm run db:seed:twice` | Verify seed idempotency. |
| `npm --workspace server run verify:rls` | Verify database row-level security behavior. |
| `npm --workspace client run ui:parity:screenshots` | Capture reference and React target screenshots. |

## Repository Map

```text
.
|-- procurement-platform/
|   |-- client/              # React/Vite production frontend
|   |-- server/              # Express API, Prisma schema, tests
|   |-- shared/              # Shared TypeScript contracts
|   |-- ml-service/          # Future intelligence service boundary
|   |-- docker/              # Local infrastructure notes
|   |-- docs/                # Architecture, database, UI parity docs
|   |-- scripts/             # Page generation and screenshot tooling
|   |-- docker-compose.yml   # Postgres, Redis, Elasticsearch, MinIO
|   `-- package.json         # npm workspace scripts
|-- procurex-ui/
|   |-- index.html           # Static prototype entrypoint
|   |-- assets/              # Logo, page visuals, README screenshots
|   |-- js/                  # Prototype data and app logic
|   |-- pages/               # Prototype screen modules
|   |-- styles/              # Prototype design system
|   `-- README.md
|-- DESIGN.md                # Visual system and design direction
|-- implementation path.md   # Historical implementation planning notes
|-- readme1.md               # Older local setup notes now folded here
`-- README.md                # Canonical project README
```

## Testing And Verification

Recommended local checks:

```powershell
cd procurement-platform
npm run db:validate
npm test
npm run lint:client
npm run build
```

Database security verification:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed:twice
npm --workspace server run verify:rls
```

UI parity screenshots:

```powershell
npm run dev:client
npm --workspace client run ui:parity:screenshots
```

The screenshot workflow captures both:

- reference pages from `procurex-ui/index.html?page=...`
- production React target routes such as `/procurement/marketplace`, `/dashboard`, and `/admin`

Output is saved under:

```text
procurement-platform/docs/ui-parity/screenshots/
```

## Documentation Map

| Document | Purpose |
| --- | --- |
| [`procurement-platform/README.md`](procurement-platform/README.md) | Canonical monorepo development workspace notes. |
| [`procurement-platform/client/README.md`](procurement-platform/client/README.md) | Production React client stack, commands, layout, and product model. |
| [`procurement-platform/server/README.md`](procurement-platform/server/README.md) | Express server commands and database access model. |
| [`procurement-platform/docs/architecture.md`](procurement-platform/docs/architecture.md) | End-to-end implementation guide and architecture walkthrough. |
| [`procurement-platform/docs/database.md`](procurement-platform/docs/database.md) | Prisma model decisions, migrations, and RLS verification. |
| [`procurement-platform/docs/ui-parity/README.md`](procurement-platform/docs/ui-parity/README.md) | Static-prototype-to-React parity workflow and screenshot capture. |
| [`procurement-platform/docker/README.md`](procurement-platform/docker/README.md) | Local infrastructure and Docker notes. |
| [`procurement-platform/scripts/README.md`](procurement-platform/scripts/README.md) | Operational scripts and page generation notes. |
| [`procurex-ui/README.md`](procurex-ui/README.md) | Static prototype route list and maintenance notes. |
| [`DESIGN.md`](DESIGN.md) | ProcureX visual direction and design-system reference. |

## Current Status And Roadmap

ProcureX is an active production foundation. It has a real monorepo shape, client and server workspaces, database schema, migrations, tests, local infrastructure, and a parity process for carrying the prototype into React. Some module endpoints are intentionally foundational while deeper production workflows continue to mature.

Near-term roadmap:

- Replace remaining mock client adapters with full backend module endpoints.
- Expand identity hardening, MFA, verification providers, and notification delivery.
- Complete document upload storage, hashing, signature, and audit workflows.
- Deepen sealed bid submission, evaluation committee, and approval controls.
- Add richer reporting, risk signals, supplier intelligence, and search indexing.
- Prepare deployment infrastructure, observability, CI/CD, backups, and production runbooks.
- Grow the future intelligence service boundary when enough platform data exists to support reliable models.

## License

The source code in this repository is licensed under the [MIT License](LICENSE).

ProcureX trademarks, names, logos, branding, screenshots, hosted service content, procurement records, user-uploaded content, and user/procurement data are not licensed under MIT except where separately stated. See [NOTICE](NOTICE) for details.
