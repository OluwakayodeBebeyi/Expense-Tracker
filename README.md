# School Financial Management & Reporting System

A school finance portal starter, built with React + Vite + Tailwind on the frontend and Express + Prisma + PostgreSQL on the backend.

## Current capabilities

- Administrator sign-in with bcrypt password verification and expiring HttpOnly sessions
- Protected dashboard summary for approved transactions
- Login and logout audit events
- Local PDF, JPG, and PNG upload endpoint with file-signature validation
- Database-backed granular role and permission checks for financial operations
- Paginated user and role administration, individual permission overrides, audit history, password recovery tokens, and revocable sessions
- Account, category, and payment-method setup APIs and administrator screens

Transaction-entry screens, account transaction history and reconciliation, complete reporting/export modules, school settings UI, and persistent production uploads are not implemented yet. Transaction operations are available through the authenticated API.

## Transaction API

All transaction routes require an active authenticated session and the endpoint-specific permission. Workflow writes are additionally limited to the protected Super Admin, Admin/Administrator, Financial Secretary, and Treasurer job titles. A permission by itself does not bypass this role ceiling; the Accountant/Bursar template is read-only for transactions by default. New transactions enter `pending`; only `approved` transactions are included in financial summaries. Approving income or expenditure updates the selected account balance; voiding reverses that change, and restoring reapplies it. Money values in API responses are serialized as decimal strings.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/transactions` | Filtered, searchable, sorted, paginated transaction list |
| GET | `/api/transactions/summary` | Approved income, expenditure, net balance and count; `?breakdowns=true` adds category/account totals |
| GET | `/api/transactions/:id` | Transaction details |
| POST | `/api/transactions` | Create a pending income or expenditure transaction |
| PATCH | `/api/transactions/:id` | Edit a pending or rejected transaction |
| POST | `/api/transactions/:id/approve` | Approve a pending transaction |
| POST | `/api/transactions/:id/reject` | Reject a pending transaction with `{ "reason": "..." }` |
| POST | `/api/transactions/:id/void` | Void an approved transaction with `{ "reason": "..." }` |
| POST | `/api/transactions/:id/restore` | Restore a voided, previously approved transaction |
| GET | `/api/transactions/:id/audit-logs` | Read transaction audit history |

List filters include `type`, `startDate`, `endDate`, `categoryId`, `accountId`, `paymentMethodId`, `status`, `academicSession`, `financialYear`, `search`, `page`, `pageSize` (maximum 100), `sortBy`, and `sortOrder`. Create accepts `type`, `date`, `categoryId`, `description`, `amount`, `paymentMethodId`, `accountId`, plus optional `sourceOrVendor`, `referenceNumber`, `academicSession`, `financialYear`, and `notes`. Example:

```json
{
  "type": "INCOME",
  "date": "2026-10-09",
  "categoryId": "category-id",
  "description": "Tuition payment",
  "amount": "12500.00",
  "paymentMethodId": "payment-method-id",
  "accountId": "account-id",
  "sourceOrVendor": "Parent name",
  "referenceNumber": "RCPT-001"
}
```

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts
- Backend: Express, Prisma, PostgreSQL
- Reporting: jsPDF and xlsx

## Requirements

- Node.js 22.12+
- npm 10+

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables (Linux/macOS: `cp .env.example .env`; Windows PowerShell: `Copy-Item .env.example .env`):
   ```bash
   cp .env.example .env
   ```
3. Configure PostgreSQL and set `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD` in `.env`. `DATABASE_URL` is the canonical connection variable; runtime also accepts `POSTGRES_PRISMA_URL` and `POSTGRES_URL` for Vercel integrations. Use a unique initial password between 12 and 72 UTF-8 bytes. `SCHOOL_NAME`, `SCHOOL_CURRENCY`, `SCHOOL_ACADEMIC_SESSION`, and `SCHOOL_FINANCIAL_YEAR` are optional values for a new school record.
4. Generate Prisma client, create the database schema, and seed the initial Super Admin and school settings:
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
- Successful login sets an eight-hour signed HttpOnly session cookie and stores a revocable session record in PostgreSQL. Cookies use `SameSite=Lax` and `Secure` in production.
- Every protected request checks session revocation, current account and role status, and current database permissions. Permission changes apply on the next request without waiting for a new login.
- Login attempts are throttled using HMAC-hashed email/IP keys stored in PostgreSQL. Do not delete `LoginThrottle` records while investigating suspicious activity.
- Public account registration and hardcoded default passwords are disabled. The seed script requires the configured initial email/password only when it cannot find an existing Super Admin. It preserves an existing owner account and never replaces its password.

### Roles and administration

- The default templates are Super Admin, Admin, Accountant / Bursar, Financial Secretary, Treasurer, Auditor, and Management / Viewer. Custom roles receive only explicitly assigned permissions.
- Users have one primary role plus explicit per-user allow/deny overrides. Multiple primary roles are not supported.
- Super Admin protection uses `User.isSuperAdmin`, not the display name. Its account cannot be edited, reassigned, suspended, deleted, or reset by the user-management API. The owner can create ordinary admins but cannot grant a permission they do not hold through the normal role editor.
- Open `/admin` while signed in with a user holding user or role view permissions. The API independently enforces all permissions; hiding controls in the browser is not the security boundary.
- User deletion is refused for accounts referenced by financial or audit history. Suspend those accounts instead. Roles with assigned users cannot be deleted or deactivated.
- Administrator-initiated password resets create a one-time token with a 30-minute expiry. No mail provider is configured, so deliver the returned token through an approved secure channel. The user completes it at `/reset-password`; completion revokes their active sessions.
- To recover the existing Super Admin only, set `SUPER_ADMIN_RECOVERY_EMAIL` to the exact owner email and `SUPER_ADMIN_RECOVERY_PASSWORD` to a unique 12–72 byte password in a trusted environment, run `npm run admin:recover`, then remove those temporary variables. The command will not create a new owner or recover an account with a different email.

### Database migration and upgrade

The migration set contains a baseline for clean databases and an additive access-control migration. Existing deployments created with `prisma db push` have no migration history. Back up the database and test this procedure on a staging copy first. For an existing database whose schema matches the repository’s prior Prisma schema, mark only the baseline as already applied, then apply the additive migration and run the seed:

```bash
npx prisma migrate resolve --applied 00000000000000_initial
npm run prisma:migrate:deploy
node --import tsx server/seed.ts
```

For a brand-new database, run `npm run prisma:migrate:deploy` followed by the seed. Do not use `migrate reset` against real data. Existing signed sessions will require users to sign in again after the access-control upgrade because new session IDs must have database records.

## Production build

```bash
npm run build
```

## Vercel deployment

- Set `DATABASE_URL` and `JWT_SECRET` in Vercel for Production and Preview; Neon integrations generally provide `DATABASE_URL`. Runtime also accepts `POSTGRES_PRISMA_URL` and `POSTGRES_URL` as fallbacks. Redeploy after changing environment variables.
- For local use, link the Vercel project and pull its Development environment with `vercel env pull .env.local`; `.env*` files stay out of Git.
- Configure production-only secrets in Vercel. For the first Super Admin only, use `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD`; later seed runs preserve the existing owner password/account.
- Test the additive migration on a staging copy and follow the baseline instructions above. Do not run `db push`, `migrate reset`, or a production migration until you have a verified backup and an approved maintenance window.
- Each file under `api/` exports the shared Express app as a Vercel Function. Vercel does not run the local `server/index.ts` process.
- Vercel's function filesystem is temporary, so the upload endpoint returns `503` there until persistent object storage is implemented. Local uploads are stored in `uploads/`.
- Never commit `.env`, database URLs, JWT secrets, or initial administrator passwords.
- Back up PostgreSQL using your provider's managed backup/PITR facilities before migrations. Test restores into a separate database; this repository does not automate backups.
- The report generation is backed by server-side totals and filters to keep the output consistent with the database.
