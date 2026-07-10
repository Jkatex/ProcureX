# ProcureX Server

TypeScript Express backend and Prisma database foundation for ProcureX.

## Commands

From the monorepo root, run the local server with the tracked example environment:

```powershell
npm run dev:server:example
```

This loads `server/.env.example` directly. Prisma validation, migration, seed, and RLS verification scripts also load `server/.env.example` through the workspace scripts.

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed:twice
npm run db:cleanup:demo-admin
npm run verify:rls
npm test
```

Run these from the monorepo root with workspace forwarding when preferred:

```powershell
npm run db:validate
npm run db:migrate
npm run db:seed:twice
npm test
```

Copy `server/.env.example` to `server/.env` only when you need custom local settings.

## Database Logic

- `AccountType` is limited to `USER` and `ADMIN`.
- Normal user behavior is scoped by `current_user_id`, `current_organization_id`, and company capabilities.
- Buyer and supplier behavior is stored as `OrganizationCapabilityName.BUYER` and `OrganizationCapabilityName.SUPPLIER`.
- Evaluator, approver, auditor, and observer behavior is represented by workflow assignments, not login roles.
- Platform admin inspection is account-type based and is blocked from changing evaluation scores by RLS.
