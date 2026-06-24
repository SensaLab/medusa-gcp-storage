# @zosmaai/medusa-v2-gcp-file-provider — Medusa v2 GCP File Plugin

Google Cloud Storage file provider plugin for Medusa v2. Published as an npm package.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js, TypeScript, pnpm |
| Framework | **Medusa v2 plugin** (`@medusajs/framework`) |
| Storage | **Google Cloud Storage** (`@google-cloud/storage`) |
| DB | PostgreSQL via MikroORM (`@mikro-orm/postgresql`) |
| Testing | Medusa test utils |
| Linting | ESLint |
| CI/CD | GitHub Actions (`release.yaml`) |
| Publish | npm (`@zosmaai/medusa-v2-gcp-file-provider`) |

## Structure

```
src/
  index.ts       # Plugin entry — registers GCP file service
  service.ts     # GCP file service implementation (upload, delete, etc.)
```

## Development

```bash
pnpm install
pnpm dev              # Medusa plugin dev mode
pnpm build            # medusa plugin:build
pnpm lint
pnpm lint:fix
```

## Release (GitHub Actions)

Triggered by push to `main` (see `.github/workflows/release.yaml`):
- Builds, versions, publishes to npm

## Installed Agent Skills

- **`aj-geddes/useful-ai-prompts@nodejs-express-server`** (2.8K ⬇)
