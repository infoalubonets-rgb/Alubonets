# Alubonets implementation decisions

Last reviewed: 30 July 2026

| Topic | Decision | Status |
|---|---|---|
| Executive Committee content | Keep the Executive Committee section inside the About page. A dedicated route is not required. | Confirmed |
| What We Do content | Keep welfare, empowerment, governance and related content inside the About page. A dedicated route is not required. | Confirmed |
| Official contact email | `infoalubonets@gmail.com` | Confirmed |
| Current test hosting | Netlify at `alubonets.netlify.app` | Confirmed |
| Future production hosting | Vercel; migration date and final domain remain undecided. | Confirmed direction |
| Database classification | The connected Supabase project contains real production data. Treat all schema and data operations as production changes. | Confirmed |
| Development accounts | Retain preset accounts for local development only. Do not expose the selector in production builds. | Confirmed |
| Database backups | Use Supabase-managed database backups. Verify plan coverage and restoration capability before launch. | Confirmed direction |
| Error monitoring | Use structured provider logs initially. Add Sentry after an account/project is created. | Confirmed direction |
| Production deployment approval | Owner still to be named before Vercel production launch. | Open |
| Personal-data retention | Committee approval required. | Open |
| Contact-message retention | Committee approval required. | Open |
| Uploaded-file retention | Committee approval required. | Open |
| Finance correction policy | Treasurer/committee approval required before finance-ledger implementation. | Open |
| Loan rules | Committee approval required before the loan module. | Open |
