# Evaluation Frontend Test Data

This guide describes the default way to test the evaluation frontend with realistic local data. It uses the real backend, Prisma seed data, authentication, permissions, API calls, and the browser UI.

## Quick Start

From `procurement-platform/`:

```powershell
npm run infra:up
npm run db:migrate
npm run db:seed:evaluation-intake-demo
npm run dev
```

Open the app at:

```text
http://localhost:5173/evaluation
```

Sign in with the seeded buyer:

```text
Email: evaluation-buyer@procurex.tz
Full name: Sirilli Ammi
Phone: 0693683731
Password: Demo123!
Signature keyphrase: Signing123
```

The seed is idempotent for its demo dataset. Re-running it resets the seeded evaluation tenders and clears any draft/completed state from previous local test runs.

## Seeded Evaluation Data

The `db:seed:evaluation-intake-demo` script creates four evaluation-ready tenders:

| Reference | Category |
| --- | --- |
| `PX-GDS-2026-001` | Goods |
| `PX-WRK-2026-002` | Works |
| `PX-SRV-2026-003` | Non-Consultancy Services |
| `PX-CON-2026-004` | Consultancy Services |

Each tender includes:

- Closed tender status and completed bid opening.
- Two submitted supplier bids.
- Supplier organizations and users.
- Bid documents, responses, versions, and receipts.
- Tender requirements and required tender documents.
- Commercial, BOQ, or price schedule rows.
- Evaluation workspace criteria.
- Buyer and supplier signing credentials for final submission, award responses, and contract signing.

## Seeded Supplier Accounts

All seeded suppliers use password `Demo123!` and signing keyphrase `SupplierSigning123!`.

| Tender | Supplier | Email | Phone | Password | Keyphrase |
| --- | --- | --- | --- | --- | --- |
| Supply of Emergency Medical Consumables | Afya Medical Supplies Ltd | `afya-medical-supplies-ltd@evaluation-demo.procurex.tz` | `0693683741` | `Demo123!` | `SupplierSigning123!` |
| Supply of Emergency Medical Consumables | Kisasa Health Logistics | `kisasa-health-logistics@evaluation-demo.procurex.tz` | `0693683742` | `Demo123!` | `SupplierSigning123!` |
| Rehabilitation of Municipal Stormwater Drains | Ujenzi Bora Contractors Ltd | `ujenzi-bora-contractors-ltd@evaluation-demo.procurex.tz` | `0693683743` | `Demo123!` | `SupplierSigning123!` |
| Rehabilitation of Municipal Stormwater Drains | Prime Civil Works Ltd | `prime-civil-works-ltd@evaluation-demo.procurex.tz` | `0693683744` | `Demo123!` | `SupplierSigning123!` |
| Provision of Hospital Cleaning and Waste Handling Services | SafiCare Services Ltd | `saficare-services-ltd@evaluation-demo.procurex.tz` | `0693683745` | `Demo123!` | `SupplierSigning123!` |
| Provision of Hospital Cleaning and Waste Handling Services | GreenClean Tanzania Ltd | `greenclean-tanzania-ltd@evaluation-demo.procurex.tz` | `0693683746` | `Demo123!` | `SupplierSigning123!` |
| Consultancy for Water Utility Revenue Improvement | Maji Advisory Partners Ltd | `maji-advisory-partners-ltd@evaluation-demo.procurex.tz` | `0693683747` | `Demo123!` | `SupplierSigning123!` |
| Consultancy for Water Utility Revenue Improvement | Nile Basin Consulting Ltd | `nile-basin-consulting-ltd@evaluation-demo.procurex.tz` | `0693683748` | `Demo123!` | `SupplierSigning123!` |

## Manual Frontend Checks

Use each seeded tender to walk the UI through these states:

- Evaluation landing page shows published and ready tenders.
- Search and filters work by reference, buyer, status, and procurement type.
- `View Tender` opens the tender detail page and returning to evaluation keeps the list healthy.
- `Start Evaluation` opens the workspace.
- Opening Register displays submitted bids, receipt numbers, original amounts, and bid metadata.
- Administrative & Eligibility decisions can be changed and saved.
- Custom Evaluation Criteria scores and comments can be entered.
- `Save Draft` works, then a reload shows `Continue Evaluation` and restores progress.
- Financial Review displays commercial rows, evaluated prices, and score fields.
- Verification/Post-Qualification renders for goods, works, and services.
- Due Diligence & Negotiation renders for consultancy.
- Ranking & Recommendation updates recommendation decisions.
- Evaluation Report renders the final summary.
- Submit Evaluation opens the signature modal and completes with `Signing123`.

## Automated Check

Run the Playwright workflow while the frontend and API are running:

```powershell
npm run test:e2e:evaluation
```

The script reseeds the evaluation intake demo by default, signs in through the API, drives the browser through all four tenders, saves drafts, restores drafts, and submits the final evaluation.

Because the automated workflow completes the seeded tenders, run `npm run db:seed:evaluation-intake-demo` again before returning to manual testing.

Successful output must show:

- `Evaluation E2E passed at http://localhost:5173`
- Four JSON summaries, one per seeded tender.
- `draftRestored: true` for every tender.
- `finalSubmission: true` for every tender.
- Empty `bugs` arrays.

Useful environment overrides:

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:5173"
$env:PLAYWRIGHT_API_BASE_URL="http://localhost:4000"
$env:PLAYWRIGHT_HEADLESS="false"
$env:EVALUATION_E2E_RESEED="false"
$env:EVALUATION_E2E_SCREENSHOT_DIR="client/.cache/evaluation-e2e"
```

## Expanding Test Data Later

Add a separate seed script only when the existing four tenders do not cover the UI state you need. Use a distinct `demoDataset` value so the new data can be reset independently from `evaluation-intake-demo`.

Recommended future edge cases:

- No ready tenders.
- One ready tender with many bids.
- Long tender and supplier names.
- Missing optional documents.
- Failed administrative bidder.
- Failed technical threshold bidder.
- Locked tender before bid opening.
- Completed evaluation record.
- Drafted evaluations at different stages.

Keep the evaluation API shape unchanged for this path. The goal is frontend coverage through realistic local data, not new production behavior.
