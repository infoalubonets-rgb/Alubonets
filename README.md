# Alubonets SHG

Public website and member platform for Alubonets Self-Help Group.

Built with **Next.js 15** (App Router), **TypeScript**, **Tailwind CSS**, **Prisma**, and **Supabase**.

## Project structure

```
app/
  (public)/          # Public site (shared nav, motto, footer)
    page.tsx         # Home
    about/
    projects/
    gallery/
    contact/
  admin/             # Admin panel (separate layout)
  globals.css
  layout.tsx         # Root layout (fonts, metadata)
components/
  layout/            # Navbar, Footer, Motto, SiteScripts
  auth/              # Auth modal
  about/             # About-page widgets
lib/                 # Prisma, Supabase, shared constants
prisma/              # Database schema
docs/                # Design docs
```

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Prisma Studio |
