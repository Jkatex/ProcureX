# Docker

Local infrastructure is currently defined in the repository-level `docker-compose.yml`. A full production VPS stack is defined in `docker-compose.prod.yml`.

From `procurement-platform/`, start the local services used by `server/.env.example`:

```powershell
npm run infra:up
```

Stop them with:

```powershell
npm run infra:down
```

Local service ports:

| Service | URL / port |
| --- | --- |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Elasticsearch | `http://localhost:9200` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |

These endpoints match the local defaults in `server/.env.example`.

## Production VPS Stack

The production stack builds and runs:

- Caddy web server for the Vite client, TLS, SPA fallback, `/api/*`, and `/health` proxying
- Express/Prisma server
- PostgreSQL, Redis, Elasticsearch, and MinIO
- One-shot Prisma migration and MinIO bucket initialization jobs

Prepare a production env file:

```powershell
Copy-Item .env.production.example .env.production
```

Replace every placeholder in `.env.production`, especially passwords, API keys, domain values, registry credentials, Turnstile, Resend, SMS, and signing secrets.

Build and start the stack from `procurement-platform/`:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check the deployment:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl https://your-domain.example/health
```

Only Caddy publishes host ports `80` and `443`. Database, cache, search, object storage, migrations, and the API server stay on Docker networks.

Production Dockerfiles live here:

- `server.Dockerfile`
- `web.Dockerfile`
- `Caddyfile`

The ML service is still a placeholder and is not part of the production stack yet.
