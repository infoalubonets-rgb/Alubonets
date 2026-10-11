# Alubonets SHG

Website and private member platform for **Alubonets Self-Help Group**.

Built with Next.js, TypeScript, Tailwind CSS, Prisma and Supabase.

## Getting started

Access to this repository and its environments is restricted to the project team.

```bash
npm install
cp .env.local.example .env.local   # ask the project lead for the values
npm run dev                        # http://localhost:3001
```

Database, environment and deployment steps are in the operations guide.

## Documentation

| Document | What it covers |
|---|---|
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Setup, environments, deployment, backups and monitoring |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data model, design system, technical decisions and security |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Target data model and relationship rules |
| [docs/ROLES.md](docs/ROLES.md) | Roles, permissions and what each role sees |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Feature status, recent changes and open decisions |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Testing, sign-off checklist and role guides |

## Tests

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # browser smoke tests (Playwright)
```

## Ownership

Prepared for Alubonets Self-Help Group by SpectreTech Limited. Not for public distribution.
