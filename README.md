# Procure-to-Pay System

A full-stack, enterprise-grade Procure-to-Pay platform designed to manage the end-to-end procurement lifecycle: purchase requests (PRs), requests for quotations (RFQs), multi-supplier quote comparisons, approval workflows, purchase orders (POs), and delivery tracking.

---

## Tech Stack

- **Frontend**: React 18, Vite (JavaScript), React Router v6, `@supabase/supabase-js`, Vanilla CSS design system.
- **Backend**: Node.js 20, Express (ES modules), `@supabase/supabase-js` (Service Role client), `pg` (PostgreSQL client pool), `zod` (runtime schema validation), `dotenv`, `cors`, `helmet`, `morgan`.
- **Database**: Supabase (Hosted PostgreSQL) with `pgcrypto` extension and tracked migrations.
- **Data Generator**: Python 3.11+, `faker`, `pandas`, `python-dotenv`, `psycopg2-binary`.

---

## Folder Structure

```
procure-to-pay/
├── README.md                           # Main documentation & setup guide
├── .gitignore                          # Git exclusions for dependencies, environments, build artifacts
├── package.json                        # Monorepo root scripts with concurrently
├── docs/
│   ├── data_dictionary.md              # Domain entity definitions & column schemas
│   ├── er_diagram.md                   # Relational database schema diagrams
│   ├── business_rules.md               # Approval hierarchies, state machine & validation constraints
│   └── validation_summary.md           # Integrity checks and ground truth verification
├── database/
│   ├── migrations/
│   │   └── 000_extensions_and_setup.sql# Initial migration: pgcrypto extension setup
│   ├── seeds/                          # SQL seed files
│   └── scripts/
│       └── run_migrations.js           # Idempotent Node migration runner using pg
├── backend/
│   ├── package.json                    # Backend dependencies & dev scripts
│   ├── .env.example                    # Backend environment template
│   └── src/
│       ├── server.js                   # HTTP server lifecycle & graceful shutdown
│       ├── app.js                      # Express middleware, security, and route mounting
│       ├── config/
│       │   ├── env.js                  # Fail-fast Zod environment validation
│       │   ├── supabase.js             # Supabase Admin client with SERVICE ROLE key
│       │   └── pg.js                   # PostgreSQL Connection Pool using DATABASE_URL
│       ├── routes/
│       │   ├── index.js                # API root router (/api)
│       │   └── health.routes.js        # Health endpoints (/api/health, /api/health/db)
│       ├── controllers/
│       │   └── health.controller.js    # Health diagnostics handlers
│       ├── services/                   # Business logic layer (empty)
│       ├── middleware/
│       │   ├── errorHandler.js         # Centralized error handler
│       │   └── notFound.js             # 404 handler
│       └── utils/
│           └── logger.js               # Structured logger
├── frontend/
│   ├── package.json                    # Frontend dependencies & Vite scripts
│   ├── .env.example                    # Frontend environment template
│   ├── vite.config.js                  # Vite configuration & dev proxy (/api -> localhost:5000)
│   ├── index.html                      # HTML5 entry template
│   └── src/
│       ├── main.jsx                    # React root entry point
│       ├── App.jsx                     # Route configuration
│       ├── lib/
│       │   ├── supabaseClient.js       # Supabase client using public ANON key
│       │   └── api.js                  # Standardized fetch wrapper
│       ├── pages/
│       │   └── Home.jsx                # Health & DB connection diagnostics dashboard
│       ├── components/                 # Reusable UI component library (empty)
│       └── styles/
│           └── index.css               # Design system tokens and styling
└── data_generator/
    ├── requirements.txt                # Python dependencies (faker, pandas, psycopg2-binary)
    ├── .env.example                    # Generator environment template
    ├── README.md                       # Generator CLI documentation
    ├── config.py                       # Seed constants, baselines, and scaling logic
    ├── generate.py                     # CLI entry point (--scale, --seed, --out)
    ├── generators/                     # Entity generation logic
    ├── validators/                     # Data integrity and FK validation
    ├── utils/
    │   ├── __init__.py
    │   ├── ids.py                      # Deterministic ID generators (PR, RFQ, QUO, PO, DEL)
    │   └── db.py                       # psycopg2 database connection helper
    └── output/                         # Output destination for synthetic datasets
        ├── csv/                        # CSV tables
        ├── json/                       # JSON payloads
        ├── sql/                        # SQL insert statements
        └── ground_truth/               # Validation ground truth
```

---

## Prerequisites

Before setting up the project, make sure you have:

1. **Node.js**: v20.x or higher (`node -v`)
2. **npm**: v10.x or higher (`npm -v`)
3. **Python**: v3.11 or higher (`python --version`)
4. **Supabase Account**: A free Supabase project at [supabase.com](https://supabase.com).

---

## Step-by-Step Local Setup

### 1. Create a Supabase Project

1. Log in to [supabase.com](https://supabase.com) and create a new project (e.g., `procure-to-pay`).
2. Obtain your project credentials from **Project Settings**:
   - **Database Connection String** (`Settings -> Database -> Connection string -> URI`):
     ```
     postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
     ```
   - **Project URL & API Keys** (`Settings -> API`):
     - `Project URL`: `https://<project-ref>.supabase.co`
     - `anon` public key (safe for browser)
     - `service_role` secret key (for backend server only)

### 2. Copy and Configure Environment Files

Navigate to the project directory:

```bash
cd procure-to-pay
```

#### Backend Environment
Create `backend/.env` from `backend/.env.example`:
```bash
cp backend/.env.example backend/.env
```
Fill in the values:
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DATABASE_URL=postgresql://postgres:<your_password>@db.<project-ref>.supabase.co:5432/postgres
CORS_ORIGIN=http://localhost:5173
```

#### Frontend Environment
Create `frontend/.env` from `frontend/.env.example`:
```bash
cp frontend/.env.example frontend/.env
```
Fill in the values:
```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_BASE_URL=http://localhost:5000/api
```

#### Data Generator Environment
Create `data_generator/.env` from `data_generator/.env.example`:
```bash
cp data_generator/.env.example data_generator/.env
```
Fill in the database URL:
```env
DATABASE_URL=postgresql://postgres:<your_password>@db.<project-ref>.supabase.co:5432/postgres
```

---

### 3. Install Dependencies

Install root, backend, and frontend packages with a single command from the project root:

```bash
npm run install:all
```

For the data generator (optional until generating data):
```bash
cd data_generator
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Unix/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

---

### 4. Run Database Migrations

Apply the initial schema migration (`000_extensions_and_setup.sql`) idempotently via the migration runner:

```bash
npm run db:migrate
```

This verifies database connectivity, creates the `schema_migrations` tracking table if missing, and executes pending SQL migrations in numerical sequence.

---

### 5. Start the Application

Start both the Node/Express backend and Vite React frontend concurrently:

```bash
npm run dev
```

- **Backend API**: Running on [http://localhost:5000](http://localhost:5000)
- **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **DB Health**: [http://localhost:5000/api/health/db](http://localhost:5000/api/health/db)
- **Frontend App**: Running on [http://localhost:5173](http://localhost:5173)

Open [http://localhost:5173](http://localhost:5173) in your browser. The Home page will query both health endpoints and display:
- **Backend API**: OK (Online)
- **PostgreSQL Pool**: OK (SELECT NOW() verified)
- **Supabase Client**: OK (Admin Auth service verified)

---

### 6. Run Data Generator & Validation

Generate the baseline dataset (seed `20261022`, scale `1.0`), inject the 7 labelled edge cases, export CSV/JSON/SQL files, and verify 100% reproducibility:

```bash
python data_generator/generate.py --scale 1.0 --seed 20261022 --verify-reproducibility
```

All exported files are generated under `data_generator/output/`:
- `output/csv/*.csv`: Delimited tables for all operational entities
- `output/json/*.json`: JSON arrays for each entity
- `output/sql/seed_all.sql`: Dependency-ordered PostgreSQL seed script
- `output/ground_truth/`: Isolated `ground_truth.csv` and `ground_truth.json`
- `output/manifest.json`: Checksum inventory and row counts

---



