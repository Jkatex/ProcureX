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

To load the optional API-backed Awarding and Contract Management demo dataset:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed
npm run db:seed:awards-demo
```

The demo seed is idempotent and only recreates records marked as the `award-contract-full` dataset or references prefixed with `PX-DEMO-AC-`. Use `award-demo@procurex.tz` with password `Demo123!` to inspect populated buyer and supplier award queues, contract formation, post-award tracking, payment, risk, termination, close-out, supplier performance, and compliance screens.

To load mock marketplace tenders that supplier users can bid:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed
npm run db:seed:marketplace-demo
```

The marketplace demo seed creates separate buyer and supplier organizations so ownership and bidding rules are realistic. Sign in as `market-buyer@procurex.tz` or `market-buyer2@procurex.tz` with `Market123!` to inspect buyer-owned tenders. Sign in as `huui@gmail.com` with `55566677` to inspect Huui-owned mock tenders for evaluation and award recommendation review. Sign in as `ict-supplier@procurex.tz`, `works-supplier@procurex.tz`, or `services-supplier@procurex.tz` with `Supplier123!` to save public tenders, prepare draft bids, and submit bids on tenders owned by other organizations. `My Tenders` shows only tenders created by the exact logged-in user; another user in the same organization should not see that tender as their own.

## Local Testing Data

Registration code delivery can stay local during development. With `IDENTITY_EMAIL_PROVIDER=dev-console` and `IDENTITY_PHONE_PROVIDER=dev-console`, the registration phone code and email activation code are shown in the UI and logged by the server. Production delivery uses Resend for email and Beem Africa for SMS or WhatsApp.

Use these dev-only TRA/BRELA identifiers during identity verification. They are served only outside production.

| Applicant type | Source option | Identifier | Expected name |
| --- | --- | --- | --- |
| Individual | TIN / TRA | `1234567890` | Asha Juma Mwinyi |
| Business | TIN / TRA | `1234567890` | Asha Juma Trading Enterprise |
| Individual | TIN / TRA | `1098765432` | Neema Ally Msuya |
| Business | TIN / TRA | `1098765432` | Neema Fresh Logistics |
| Individual | TIN / TRA | `555666777` | Baraka Hassan Mrema |
| Business | TIN / TRA | `555666777` | Mwanza Medical Supplies |
| Company | BRELA | `987654321` | Local Test Supplies Limited |
| Business | BRELA | `987654321` | Local Test Supplies Business Name |
| Company | BRELA | `BRN-2024-001` | Kilimanjaro Works Limited |
| Business | BRELA | `BRN-2024-001` | Kilimanjaro Works |
| Company | BRELA | `BN-778899` | Zanzibar Digital Services Limited |
| Business | BRELA | `BN-778899` | Zanzibar Digital Services |

## Product Rules Captured Here

- Login account type is only `USER` or `ADMIN`.
- A normal user belongs to a company account.
- A company can act as buyer, supplier, or both through organization capabilities and profiles.
- Admin is a platform compliance account, not a buyer or supplier role.
- Buyer, supplier, evaluator, and approver behavior is represented by organization capabilities and workflow assignments.
