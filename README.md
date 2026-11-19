# Business Suite

An integrated, multi-tenant enterprise operating system built with Next.js 16 Turbopack, React 19, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

It unifies **Projects**, **CRM**, and **Finance** into a single cohesive workspace with real-time collaboration, role-based access control, and cross-module automations.

---

## 🚀 Key Modules

### 1. Projects Workspace (Zoho Projects Architecture)
- **Single-Project Workspaces (`/[orgSlug]/projects/[id]`)**: Interactive breadcrumbs, strict project indicators, % completion bars, and customizable module tabs.
- **Tasks & Milestones**: Classic list view with multi-column grouping, Kanban board view with drag-and-drop status stages, and horizontal Gantt timeline charts with predecessor/successor dependencies.
- **Task Slide-over Drawer**: Subtasks, dependencies, time logging, @mentions comments, attachments, and activity history.
- **Issues Tracker**: Severity, classification, reproducible steps, Kanban board, and issue resolution workflows.
- **Time Logs & Timesheets**: Live stopwatch timer, daily/weekly grid logging, billable status toggles, and timesheet submission/approval workflows.
- **Approvals Central (`/[orgSlug]/projects/approvals`)**: Bulk approval actions, perspective switchers, rejection modal with mandatory notes, and detail drawers for timesheets, expense claims, and milestone deliverables.
- **Collaboration Hub (`/[orgSlug]/projects/collaboration`)**: Real-time project feed, knowledge base wiki pages, threaded forums, and shared project documents.
- **Setup & Blueprints**: Portal configuration (org hours, holidays), custom statuses & priorities, RBAC permissions matrix, and workflow automation rules.

### 2. CRM
- **Deals Pipeline**: Visual stage progression from Qualification to Closed Won.
- **Contacts & Companies**: Customer profiles, communication history, and associated transactions.
- **Cross-Module Automation**: Closing a deal automatically triggers the creation of associated delivery projects and draft invoices.

### 3. Finance & Invoicing
- **Quotes & Invoices**: Itemized billing, tax calculation, and payment status tracking.
- **Expenses & Payments**: Reimbursable expense logging, payment collection, and project budget burn tracking.
- **Items & Pricing**: Service catalogs and hourly rate profiles.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (Turbopack, App Router, Server Actions)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) / [Neon](https://neon.tech/) with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: Multi-tenant session cookies with secure bcrypt hashing and granular RBAC.

---

## 🏁 Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database (local instance or [Neon Serverless Postgres](https://neon.tech))

### 2. Installation
```bash
git clone https://github.com/YtterStick/business-suite.git
cd business-suite
npm install
```

### 3. Environment Setup
Copy the example environment file and configure your database credentials:
```bash
cp .env.example .env
```
Update `DATABASE_URL` with your PostgreSQL connection string.

### 4. Database Setup & Seeding
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📜 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Run production build
- `npm run typecheck` - Run TypeScript compiler check
- `npm run db:seed` - Seed database with demo tenant and records
