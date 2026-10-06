# Pacific Surfaces — Lab ERP

Laboratory / R&D sub-ERP: lab samples, their formulations, design, vein, L/a/b readings and output files, with the master lists that feed every dropdown.

**Live sections:** Dashboard (with the Forum), Sample Data Entry, Sample Inward / Outward (with Rectification), Production Sample, Reports, Downloads and Master Data.

> **Updating an existing install:** after copying new code, run `npm install` and `npm run db:push` (applies new tables/columns), then `npm run db:seed` (adds any new master lists). Existing data is kept.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · React Hook Form + Zod · Recharts · ExcelJS · Inngest.

---

## First run (Windows, local — no Docker)

You need **Node.js 20+** and **PostgreSQL 16** installed on Windows as a normal service. Docker is not used.

### 1. PostgreSQL

Check whether it is already installed (PowerShell):

```powershell
Get-Service postgresql*
```

If it shows a `postgresql-x64-16` service that is **Running**, skip to step 2. Otherwise install it once — the installer from postgresql.org (Windows → EDB installer, version 16), or:

```powershell
winget install PostgreSQL.PostgreSQL.16
```

Keep port **5432** and note the password you set for the `postgres` user. The service then starts with Windows by itself.

### 2. Point `.env` at it

In `.env`, put your `postgres` password into **both** `DATABASE_URL` and `DIRECT_URL`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/pacific_lab_erp?schema=public"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/pacific_lab_erp?schema=public"
```

(If the password contains `@ # / : %`, write them as `%40 %23 %2F %3A %25`.) The `pacific_lab_erp` database does not need to exist — step 3 creates it.

### 3. Install, create the database and tables, seed

```powershell
npm install
npx prisma db push
npm run db:seed
```

(`npm run setup` runs the same three.)

### 4. Run

```powershell
npm run dev
```

Open http://localhost:3000 — it opens straight to the Dashboard. **Sign-in is switched off for now** (see below). Next time, only `npm run dev` is needed.

Tablets on the plant network: `npm run build` then `npm start`, and open `http://<this-PC's-IP>:3000`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |
| `npm run db:seed` | Master lists + first admin (safe to re-run; never overwrites edits) |
| `npm run db:studio` | Browse the database |
| `npm run typecheck` · `npm run lint` · `npm test` | Checks |
| `npm run inngest:dev` | Run the scheduled background jobs locally (optional) |

## Sign-in (currently off)

There is no sign-in or sign-up page for now. Everyone who opens the ERP works as one built-in **Admin** user (`SEED_ADMIN_NAME`, default "Lab Admin"), so every screen and action is available, and saved records show that name as "created by". The user is created automatically on first use.

The role rules are still in place in `src/lib/permissions.ts` (Admin, Manager, Lab Operator, Viewer — e.g. only Managers/Admins delete samples or start Forum posts, while Lab Operators can reply), so they take effect again the moment sign-in returns. To switch sign-in back on, `currentUser()` in `src/lib/session.ts` is the only place to change — every page, action and download reads the user through it.

> While sign-in is off, anyone who can reach the ERP's address can use it. Keep it on the plant network only.

## Production (Neon)

* `DATABASE_URL` = Neon **pooled** connection string, `DIRECT_URL` = Neon **direct** string.
* Before the first production deploy, switch from `db push` to migrations: `npx prisma migrate dev --name init` locally, commit `prisma/migrations`, and deploy with `npx prisma migrate deploy`.
* Uploaded files: `STORAGE_DRIVER=local` writes to disk, which serverless hosts do not keep. Add an object-storage driver (S3 / R2 / Vercel Blob) in `src/lib/storage/` — callers don't change.
* Set `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` and sync `/api/inngest` in Inngest to run the nightly cleanup of abandoned uploads.

See `docs/ARCHITECTURE.md` for the data model and design decisions.
