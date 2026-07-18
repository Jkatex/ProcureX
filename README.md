# ProcureX Local Setup

This README is the practical setup guide for running the ProcureX procurement platform locally. For the product overview, architecture narrative, screenshots, and roadmap, see [Introduction.md](Introduction.md). For deeper workspace notes and demo datasets, see [procurement-platform/README.md](procurement-platform/README.md).

## Prerequisites

- Node.js `>=20.19`
- npm with workspace support
- Docker Desktop or Docker Engine with Docker Compose
- Git
- PowerShell on Windows, or an equivalent shell with adjusted commands

## Required Local Ports

Make sure these ports are free before starting the full stack:

| Service | URL / host |
| --- | --- |
| React client | `http://localhost:5173` |
| Express API | `http://localhost:4000` |
| PostgreSQL | `127.0.0.1:55432` |
| Redis | `127.0.0.1:6379` |
| Elasticsearch | `http://127.0.0.1:9200` |
| MinIO API | `http://localhost:9000` |
| MinIO console | `http://localhost:9002` |

The PostgreSQL and MinIO console ports come from `procurement-platform/docker-compose.override.yml`.

## Environment Files

Local development uses the tracked example files directly:

- `procurement-platform/server/.env.example`
- `procurement-platform/client/.env.example`

For the standard local run, you do not need to copy these files. Create matching `.env` files only when you need custom local values or real provider credentials.

Important defaults:

```env
DATABASE_URL="postgresql://procurex:procurex@127.0.0.1:55432/procurex"
DIRECT_URL="postgresql://procurex:procurex@127.0.0.1:55432/procurex"
REDIS_URL="redis://127.0.0.1:6379"
ELASTICSEARCH_URL="http://127.0.0.1:9200"
S3_ENDPOINT="http://127.0.0.1:9000"
PORT="4000"
VITE_API_BASE_URL="http://localhost:4000"
VITE_DEMO_SIGN_IN_ENABLED="true"
```

Real provider secrets are intentionally blank in the example files. Add real values only in local/private environment files when needed for SMTP, Resend, Beem/Briq, Turnstile, Mailboxlayer, TRA, BRELA, or S3-compatible storage.

## Run The Full Project

From the repository root:

```powershell
cd procurement-platform
npm install
npm run infra:up
npm run db:validate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` starts both the Express API and the Vite React client. Leave that terminal running while using the app.

Open the app:

```text
http://localhost:5173
```

Check the API health endpoint:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

## Separate Terminal Option

If you prefer to run the backend and frontend separately, start them from `procurement-platform/` in two terminals after installing dependencies, starting infrastructure, and migrating/seeding the database.

Terminal 1:

```powershell
npm run dev:server:example
```

Terminal 2:

```powershell
npm run dev:client:example
```

## Local Infrastructure Credentials

| Service | Credential |
| --- | --- |
| PostgreSQL | Host `127.0.0.1:55432`, database `procurex`, username `procurex`, password `procurex` |
| MinIO | API `http://localhost:9000`, console `http://localhost:9002`, username `procurex`, password `procurex-secret` |
| Redis | `127.0.0.1:6379`, no local auth |
| Elasticsearch | `http://127.0.0.1:9200`, no local auth |

## Seeded App Credentials

The default seed creates these local-only accounts:

| Account | Email | Password | Extra |
| --- | --- | --- | --- |
| Platform admin | `admin@procurex.tz` | `Admin123!` | Signing keyphrase `ProcureXAdmin` |
| Demo user | `demo@procurex.tz` | `Demo123!` | Enabled in the client demo sign-in settings |

These credentials are for local development data only.

## Optional Demo Seeds

Run optional seeds from `procurement-platform/` after the main migration/seed flow.

| Scenario | Command | Credentials |
| --- | --- | --- |
| Evaluation intake | `npm run db:seed:evaluation-intake-demo` | `evaluation-buyer@procurex.tz` / `Demo123!`, signing keyphrase `Signing123` |
| Award-ready tender | `npm run db:seed:award-ready-demo` | `award-ready-buyer@procurex.tz` / `AwardReady123!` |
| Marketplace tenders | `npm run db:seed:marketplace-demo` | Buyers `market-buyer@procurex.tz`, `market-buyer2@procurex.tz` / `Market123!`; suppliers `ict-supplier@procurex.tz`, `works-supplier@procurex.tz`, `services-supplier@procurex.tz` / `Supplier123!`; Huui demo buyer `huui@gmail.com` / `55566677` |

More demo datasets and cleanup commands are documented in [procurement-platform/README.md](procurement-platform/README.md).

## Useful Commands

Run these from `procurement-platform/`.

| Command | Purpose |
| --- | --- |
| `npm run infra:up` | Start PostgreSQL, Redis, Elasticsearch, and MinIO |
| `npm run infra:down` | Stop local Docker services |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate` | Run local Prisma migrations |
| `npm run db:seed` | Seed default local data |
| `npm run dev` | Start API and client together |
| `npm run build` | Build shared contracts, server, and client |
| `npm test` | Run server and client tests |
| `npm run lint:client` | Run client ESLint checks |
