# ProcureX Evaluation App Explanation

## Short Presentation Summary

The Evaluation app is the buyer workspace for reviewing submitted bids after a tender has closed. It brings together the tender requirements, supplier bid documents, evaluation criteria, scoring, ranking, recommendation, audit history, and final signed completion in one place.

In simple terms:

> Evaluation starts after bidding closes. The buyer reviews submitted bids, scores suppliers, selects a recommended bidder, signs the completed evaluation, and the system prepares the recommendation for Awarding and Contracts.

## What The Evaluation App Does

- Shows tenders that are ready for evaluation.
- Shows saved evaluation drafts and completed evaluation records.
- Opens a detailed evaluation workspace for one tender.
- Displays submitted supplier bids, bid receipts, documents, responses, and financial amounts.
- Loads the evaluation criteria configured during tender creation.
- Lets the buyer score each supplier against the criteria.
- Lets the buyer review administrative, technical, financial, verification, ranking, and report stages.
- Lets the buyer mark one supplier as `RECOMMENDED`.
- Requires a digital signature keyphrase to complete the evaluation.
- Creates or updates an award recommendation so Awards and Contracts can continue the process.

## Main User Flow

1. Buyer signs in and opens `/evaluation`.
2. The frontend loads evaluation dashboard counts, ready tenders, saved drafts, and records.
3. The buyer chooses a tender that is ready for evaluation.
4. The app opens the evaluation workspace for that tender.
5. The buyer reviews submitted suppliers, documents, bid responses, and prices.
6. The buyer enters scores and comments.
7. The buyer reviews ranking and marks the recommended supplier.
8. The buyer completes the evaluation using the signing keyphrase.
9. The backend stores the completed evaluation and audit trail.
10. The backend creates an `AwardRecommendation`.
11. Awards and Contracts shows the recommendation under award decisions.

## Frontend Files

### Route And Page Registration

- `client/src/app/router.tsx`
  - Registers `/evaluation`.
  - Protects the route so the user must be authenticated.

- `client/src/features/procurexPageRegistry.tsx`
  - Maps the page key `bid-evaluation` to the Evaluation component.

- `client/src/features/evaluation/pages/EvaluationPages.tsx`
  - Small wrapper that renders the main Evaluation page.

### Main Evaluation UI

- `client/src/features/evaluation/components/procurex/BidEvaluationProcurexPage.tsx`
  - Main Evaluation app screen.
  - Loads dashboard, drafts, ready tenders, records, and workspace data.
  - Handles scoring, decisions, stage navigation, ranking, reports, and completion.

Important parts inside this file:

- `BidEvaluationProcurexPage`
  - Main React component.

- `saveWorkspace`
  - Sends scores, decisions, section draft data, and completion status to the backend.

- `EvaluationTenderListView`
  - Shows ready tenders, drafts, and evaluation records.

- `EvaluationWorkspaceView`
  - Shows the detailed evaluation workspace.

- `SupplierScoringPanel`
  - Handles criterion scoring per supplier.

- `RankingPanel`
  - Shows ranking and recommendation decisions.

- `ReportPanel`
  - Shows final evaluation report area.

### Frontend API And Types

- `client/src/features/evaluation/api/index.ts`
  - Calls the backend evaluation endpoints:
    - `GET /api/evaluations/dashboard`
    - `GET /api/evaluations/records`
    - `GET /api/evaluations/drafts`
    - `GET /api/evaluations/ready`
    - `GET /api/evaluations/tenders/:tenderId/workspace`
    - `PUT /api/evaluations/tenders/:tenderId/workspace`

- `client/src/features/evaluation/types.ts`
  - Defines frontend TypeScript contracts for:
    - Dashboard counts
    - Ready tenders
    - Evaluation records
    - Evaluation workspace
    - Bids
    - Scores
    - Rankings
    - Save payload

## Backend Files

### API Mounting And Routes

- `server/src/app.ts`
  - Mounts the evaluation module.
  - Also mounts the alias `/api/evaluations`, which is the path used by the frontend.

- `server/src/modules/index.ts`
  - Registers the evaluation backend module.

- `server/src/modules/evaluation/routes.ts`
  - Defines the HTTP endpoints:
    - `GET /dashboard`
    - `GET /records`
    - `GET /drafts`
    - `GET /ready`
    - `GET /tenders/:tenderId/workspace`
    - `PUT /tenders/:tenderId/workspace`

### Backend Layers

- `server/src/modules/evaluation/controller.ts`
  - Handles HTTP request and response logic.
  - Validates route parameters and body payloads.
  - Requires `evaluation.manage` permission when saving a workspace.

- `server/src/modules/evaluation/service.ts`
  - Converts database records into frontend-friendly response objects.
  - Builds the evaluation workspace DTO.
  - Calculates summary values, stages, criteria display, bid rankings, and availability.

- `server/src/modules/evaluation/repository.ts`
  - Contains the core persistence and business logic.
  - Finds ready tenders.
  - Creates evaluation workspaces from tenders.
  - Saves scores and decisions.
  - Completes evaluation.
  - Signs the final completion action.
  - Writes audit events.
  - Creates or updates award recommendations.

- `server/src/modules/evaluation/validators.ts`
  - Validates request input with Zod.
  - Requires a signature keyphrase when `complete: true`.

- `server/src/modules/evaluation/types.ts`
  - Defines backend DTOs and module contracts.

## Database Files

- `server/prisma/schema.prisma`
  - Defines the evaluation database schema.

Main models involved:

- `EvaluationWorkspace`
  - One evaluation workspace per tender.
  - Stores status, current stage, progress, payload, and links to criteria, scores, and recommendations.

- `EvaluationCriterion`
  - Criteria used to score bids.

- `EvaluationScore`
  - Scores and comments for each bid and criterion.

- `AwardRecommendation`
  - Recommendation created from the evaluation result.
  - This is what Awards and Contracts uses for award decisions.

- `WorkflowAssignment`
  - Assigns evaluation workflow roles to users.

## Demo And Test Files

- `server/prisma/seed-evaluation-intake-demo.ts`
  - Creates demo evaluation data.
  - Demo buyer: `evaluation-buyer@procurex.tz`
  - Password: `Demo123!`
  - Signing keyphrase: `Signing123`

- `client/e2e/evaluation-workspace-flow.mjs`
  - Automated Playwright flow for testing the Evaluation app from the UI.

- `server/src/modules/evaluation/__tests__/service.test.ts`
  - Backend tests for evaluation readiness and workspace behavior.

- `server/src/modules/evaluation/seed-evaluation-intake-demo.test.ts`
  - Tests that the evaluation demo seed creates correct ready-to-evaluate data.

## How Evaluation Connects To Awarding

The key handoff happens in:

- `server/src/modules/evaluation/repository.ts`

When a buyer saves evaluation decisions and one bid is marked `RECOMMENDED`, the backend creates or updates an `AwardRecommendation`.

Then Awards and Contracts reads that recommendation in:

- `server/src/modules/award-contract/repository.ts`

The buyer sees it under the Awards and Contracts queue called `awarding-in-progress`, shown in the UI as Award Decisions.

Presentation sentence:

> The Evaluation app does not stop at scoring. It prepares the official award recommendation record, which becomes the source for the Awarding and Contracts workflow.

## Key Technical Talking Points

- The frontend is React and TypeScript.
- The backend is Express and TypeScript.
- The database layer uses Prisma.
- Evaluation has a clean module structure: routes, controller, service, repository, validators, and types.
- The UI and backend share clear DTO shapes through TypeScript types.
- Completion is protected by digital signature keyphrase.
- Audit events are written when evaluation is started, saved, completed, and when a recommendation is prepared.
- The flow is connected to Awards and Contracts through `AwardRecommendation`.

## Demo Script For Presentation

1. Sign in as `evaluation-buyer@procurex.tz`.
2. Open Evaluation from the dashboard or go to `/evaluation`.
3. Show the dashboard cards: ready tenders, drafts, locked tenders, records.
4. Open a ready tender.
5. Show supplier bid tabs and submitted bid details.
6. Show evaluation criteria and scoring.
7. Show manual review stages.
8. Show ranking and recommendation.
9. Explain that completing requires the signing keyphrase.
10. Open Awards and Contracts and explain that recommendations continue there.

## One-Line Summary

The Evaluation app turns closed tenders and submitted bids into a signed, auditable evaluation result and prepares the recommended supplier for award approval.
