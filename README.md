# School Financial Management & Reporting System

A professional financial management application for schools, built with React + Vite + Tailwind on the frontend and Express + Prisma + PostgreSQL on the backend.

## Features

- Role-based authentication and authorization
- Password-hashed login with signed, expiring HttpOnly sessions
- Protected dashboard and API routes, logout, and login audit events
- Dashboard with summary cards and charts
- Income and expenditure management
- Categories, accounts, and payment methods
- Search, filtering, pagination, and period views
- Monthly reporting and financial summaries
- PDF generation and Excel export
- Print-friendly report layouts
- Audit log and voiding workflow
- School settings and branding

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts
- Backend: Express, Prisma, PostgreSQL
- Reporting: jsPDF and xlsx

## Requirements

- Node.js 18+
- npm 9+

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables (Linux/macOS: `cp .env.example .env`; Windows PowerShell: `Copy-Item .env.example .env`):
   ```bash
   cp .env.example .env
   ```
3. Configure PostgreSQL and set `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD` in `.env`. Use a unique initial password between 12 and 72 UTF-8 bytes.
4. Generate Prisma client, create the database schema, and seed the initial administrator and school settings:
   ```bash
   npx prisma generate
   npx prisma db push
   node --import tsx server/seed.ts
   ```
5. Start the development environment:
   ```bash
   npm run dev
   ```

The frontend runs at http://localhost:5173 and the API runs at http://localhost:4000. The dashboard redirects to `/login` until a valid session exists.

## Authentication

- Passwords are hashed with bcrypt before storage.
- Successful login sets an eight-hour signed session cookie using `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Protected API requests verify the session and check the user's current active status in PostgreSQL.
- Public account registration and hardcoded default passwords are not enabled. The initial administrator is created through the seed script.

## Production build

```bash
npm run build
```

## Vercel deployment

- Create a managed PostgreSQL database and configure `DATABASE_URL` and `JWT_SECRET` in the Vercel Production and Preview environments.
- Configure `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD` locally for one-time setup; do not commit real secrets.
- Run `npx prisma db push` and `node --import tsx server/seed.ts` against the production database from a trusted environment before enabling sign-in.
- Vercel serves the Express API through `api/[...path].ts`; it does not run the local `server/index.ts` process.
- Vercel's function filesystem is temporary. Uploads use `/tmp` unless an external persistent object store is configured.
- Never commit `.env`, database URLs, JWT secrets, or initial administrator passwords.
- The report generation is backed by server-side totals and filters to keep the output consistent with the database.
