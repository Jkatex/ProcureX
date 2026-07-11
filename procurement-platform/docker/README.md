# Docker

Local infrastructure is currently defined in the repository-level `docker-compose.yml`.

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

Future Dockerfiles should live here:

- `server.Dockerfile`
- `client.Dockerfile`
- `ml-service.Dockerfile`
