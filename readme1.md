From `procurement-platform`, run it like this.

**1. Create env files**
```powershell
cd "C:\Users\David\Documents\PROCUREX\New folder\proc-system\procurement-platform"

Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

For local bypass/testing, set these:

```env
# server/.env
IDENTITY_DEV_BYPASS="true"
DATABASE_URL="postgresql://procurex:procurex@localhost:5432/procurex"
DIRECT_URL="postgresql://procurex:procurex@localhost:5432/procurex"
PORT="4000"
```

```env
# client/.env
VITE_API_BASE_URL="http://localhost:4000"
VITE_IDENTITY_DEV_BYPASS="true"
```

**2. Start database services**
This uses `docker-compose.yml` to create Postgres, Redis, Elasticsearch, and MinIO.

```powershell
npm run infra:up
```

If `docker` is not recognized, install/start Docker Desktop first, then reopen PowerShell.

**3. Create/migrate database**
```powershell
npm --workspace server run db:migrate
```

Optional seed data:

```powershell
npm --workspace server run db:seed
```

**4. Run backend**
Use a second terminal:

```powershell
cd "C:\Users\David\Documents\PROCUREX\New folder\proc-system\procurement-platform"
npm --workspace server run dev
```

Backend should run at:

```text
http://localhost:4000
```

Check:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

**5. Run frontend**
Use a third terminal:

```powershell
cd "C:\Users\David\Documents\PROCUREX\New folder\proc-system\procurement-platform"
npm run dev:client
```

Frontend opens at:

```text
http://localhost:5173
```

Main order: `infra:up` → `db:migrate` → backend dev server → frontend dev server.