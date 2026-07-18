# ProcureX Procurement Platform

Canonical development workspace for the production ProcureX platform.

The existing `../procurex-ui` folder remains the static prototype and UI/workflow reference. This monorepo contains the backend, database, shared contracts, local infrastructure, documentation, and future service folders needed to turn that prototype into a production system.

## Structure

```text
procurement-platform/
|-- client/              # UI integration placeholder; references ../procurex-ui
|-- server/              # TypeScript Express backend, Prisma, database seed
|-- ml-service/          # Future Python/FastAPI intelligence services
|-- shared/              # Shared contracts, DTOs, and enums
|-- docker/              # Docker notes and future Dockerfiles
|-- docs/                # Architecture, database, and API documentation
|-- scripts/             # Operational scripts
|-- .github/workflows/   # CI placeholders
|-- docker-compose.yml
`-- package.json
```

## Development

The preferred local flow uses the tracked example environment files directly. Database commands load `server/.env.example`; the client example command loads `client/.env.example`.

From the repository root:

```powershell
cd procurement-platform
npm install
npm run infra:up
npm run db:validate
npm run db:migrate
npm run db:seed
```

Start the backend in terminal 1:

```powershell
npm run dev:server:example
```

Start the frontend in terminal 2:

```powershell
npm run dev:client:example
```

Open the app at `http://localhost:5173` and check the API with:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

Copy `server/.env.example` or `client/.env.example` to its matching `.env` file only when you need custom local settings.

To remove the retired API-backed Awarding and Contract Management demo dataset from a local database:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed
npm run db:cleanup:awards-demo
```

The cleanup removes records marked as the `award-contract-full` dataset, references prefixed with `PX-DEMO-AC-`, and the focused post-award reference `PX-DEMO-POST-AWARD-CONTRACT-ACTIVE-GOODS`. The default seed no longer recreates populated buyer and supplier award queues, contract formation, post-award tracking, payment, risk, termination, close-out, supplier performance, or compliance demo records.

To load the optional detailed post-award contract demo:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed:post-award-demo
```

The post-award demo seed is idempotent and creates an active goods contract with reference `PX-DEMO-POST-AWARD-CONTRACT-ACTIVE-GOODS`. Sign in as `demo@procurex.tz` with password `Demo123!`, then open Post-Award Tracking to use the seeded contract.

To load the optional award-ready tender with four submitted bids, completed evaluation, source documents, and a recommendation ready for awarding:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed
npm run db:seed:award-ready-demo
```

The award-ready seed is idempotent and only recreates records marked as the `award-ready-evaluation-demo` dataset. Sign in as `award-ready-buyer@procurex.tz` with password `AwardReady123!`, then open Awarding and Contracts to continue from the prepared recommendation.

To load a Hassan Omari Mdee award demo for the verified demo buyer:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed
npm run db:seed:hassan-award-demo
```

The Hassan award seed is idempotent and only recreates records marked as the `demo-evaluation-award-two-user` dataset. Sign in as `demo@procurex.tz` with password `Demo123!`, then open Awarding and Contracts. Hassan Omari Mdee is the recommended winner, and the signing keyphrase is `DemoAward123!`.

To load optional marketplace demo tenders that supplier users can bid:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed
npm run db:seed:marketplace-demo
```

The marketplace demo seed creates separate buyer and supplier organizations so ownership and bidding rules are realistic. Sign in as `market-buyer@procurex.tz` or `market-buyer2@procurex.tz` with `Market123!` to inspect buyer-owned tenders. Sign in as `huui@gmail.com` with `55566677` to inspect Huui-owned demo tenders for evaluation and award recommendation review. Sign in as `ict-supplier@procurex.tz`, `works-supplier@procurex.tz`, or `services-supplier@procurex.tz` with `Supplier123!` to save public tenders, prepare draft bids, and submit bids on tenders owned by other organizations. `My Tenders` shows only tenders created by the exact logged-in user; another user in the same organization should not see that tender as their own.

To test the evaluation frontend with realistic seeded tender, bid, criteria, document, draft, and signature data:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed:evaluation-intake-demo
npm run dev
```

Sign in as `evaluation-buyer@procurex.tz` with password `Demo123!`, then open Evaluation. The final submission signing keyphrase is `Signing123`. The automated Playwright workflow completes the demo tenders, so reseed with `npm run db:seed:evaluation-intake-demo` before manual testing again. See [Evaluation Frontend Test Data](docs/evaluation-frontend-test-data.md) for the manual checklist and the automated Playwright workflow.

## Local Testing Data

Registration code delivery can stay local during development. With `IDENTITY_EMAIL_PROVIDER=dev-console` and `IDENTITY_PHONE_PROVIDER=dev-console`, the registration phone code and email activation code are shown in the UI and logged by the server. For Gmail SMTP testing, set `IDENTITY_EMAIL_PROVIDER=smtp`, `SMTP_USER` to the Gmail account, and `SMTP_PASS` to a Gmail app password in `server/.env`; the tracked env example intentionally keeps these blank. Production delivery uses Resend for email and Beem Africa for SMS or WhatsApp.

Use these dev-only TRA/BRELA identifiers during identity verification. They are served only outside production.

| Applicant type | Source option | Identifier | Expected name |
| --- | --- | --- | --- |
| Individual | TIN / TRA | `1234567890` | Asha Juma Mwinyi |
| Business | TIN / TRA | `1234567890` | Asha Juma Trading Enterprise |
| Individual | TIN / TRA | `1098765432` | Neema Ally Msuya |
| Business | TIN / TRA | `1098765432` | Neema Fresh Logistics |
| Individual | TIN / TRA | `555666777` | Baraka Hassan Mrema |
| Business | TIN / TRA | `555666777` | Mwanza Medical Supplies |
| Individual | TIN / TRA | `2046813579` | Grace Paulo Mwakalinga |
| Business | TIN / TRA | `2046813579` | Grace Stationery and Office Supplies |
| Individual | TIN / TRA | `3102468975` | Moses Daniel Komba |
| Business | TIN / TRA | `3102468975` | Komba Building Materials |
| Individual | TIN / TRA | `448812006` | Rehema Said Ngalawa |
| Business | TIN / TRA | `448812006` | Pwani Catering Services |
| Individual | TIN / TRA | `6723459012` | Hassan Omari Mdee |
| Business | TIN / TRA | `6723459012` | Mdee Transport Solutions |
| Individual | TIN / TRA | `7901234568` | Rosemary Elias Sanga |
| Business | TIN / TRA | `7901234568` | Sanga Agro Inputs |
| Individual | TIN / TRA | `8642097531` | Yusuf Rajabu Khamis |
| Business | TIN / TRA | `8642097531` | Tanga Marine Supplies |
| Company | BRELA | `987654321` | Local Test Supplies Limited |
| Business | BRELA | `987654321` | Local Test Supplies Business Name |
| Company | BRELA | `BRN-2024-001` | Kilimanjaro Works Limited |
| Business | BRELA | `BRN-2024-001` | Kilimanjaro Works |
| Company | BRELA | `BN-778899` | Zanzibar Digital Services Limited |
| Business | BRELA | `BN-778899` | Zanzibar Digital Services |
| Company | BRELA | `BRN-2025-014` | Serengeti Office Solutions Limited |
| Business | BRELA | `BRN-2025-014` | Serengeti Office Solutions |
| Company | BRELA | `BN-240681` | Kisarawe Food Logistics Limited |
| Business | BRELA | `BN-240681` | Kisarawe Food Logistics |
| Company | BRELA | `BRN-2023-088` | Dodoma Fleet Services Limited |
| Business | BRELA | `BRN-2023-088` | Dodoma Fleet Services |
| Company | BRELA | `BN-661204` | Mbeya Agro Traders Limited |
| Business | BRELA | `BN-661204` | Mbeya Agro Traders |
| Company | BRELA | `BRN-2026-032` | Tanga Safety Equipment Limited |
| Business | BRELA | `BRN-2026-032` | Tanga Safety Equipment |
| Company | BRELA | `BN-902468` | Temeke Hardware Supplies Limited |
| Business | BRELA | `BN-902468` | Temeke Hardware Supplies |

## Product Rules Captured Here

- Login account type is only `USER` or `ADMIN`.
- A normal user belongs to a company account.
- A company can act as buyer, supplier, or both through organization capabilities and profiles.
- Admin is a platform compliance account, not a buyer or supplier role.
- Buyer, supplier, evaluator, and approver behavior is represented by organization capabilities and workflow assignments.

