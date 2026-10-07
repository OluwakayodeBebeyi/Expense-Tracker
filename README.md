# School Financial Management & Reporting System

A professional financial management application for schools, built with React + Vite + Tailwind on the frontend and Express + Prisma + SQLite on the backend.

## Features

- Role-based authentication and authorization
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
- Backend: Express, Prisma, SQLite
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
3. Generate Prisma client and create the SQLite database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. Seed the demo data and default admin user:
   ```bash
   node --import tsx server/seed.ts
   ```
5. Start the development environment:
   ```bash
   npm run dev
   ```

The frontend runs at http://localhost:5173 and the API runs at http://localhost:4000.

## Default login

- Email: admin@school.com
- Password: Admin@123

## Production build

```bash
npm run build
```

## Notes

- SQLite is used for local development, which keeps the setup simple and portable.
- For production, a managed PostgreSQL database can be used by updating the Prisma datasource and DATABASE_URL.
- The report generation is backed by server-side totals and filters to keep the output consistent with the database.
