# Eneba Digital Game Marketplace

![Go](https://img.shields.io/badge/Go-1.22%2B-00ADD8?style=flat-square&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B_pg__trgm-4169E1?style=flat-square&logo=postgresql&logoColor=white)

**Live Frontend (Vercel):** https://eneba-project-lime.vercel.app  
**Live Backend API (Render):** https://eneba-api-ztqj.onrender.com (Health check: https://eneba-api-ztqj.onrender.com/api/health)

A full-stack digital game key marketplace modeled after **eneba.com**, built for the **Eneba Software Engineer Internship** assignment. It combines a CMS-driven React storefront, PostgreSQL trigram fuzzy search (`pg_trgm`), multi-seller offer comparison, Stripe Checkout (Test Mode), Brevo HTTPS transactional email delivery with masked security key links, and concurrency-safe atomic digital key allocation.

---

## Live Demo & Reviewer Quick-Start

| Service | Live Production URL | Purpose |
| :--- | :--- | :--- |
| **Frontend Storefront (Vercel)** | https://eneba-project-lime.vercel.app | Interactive catalog, fuzzy search, multi-seller offer comparison, cart, Stripe Test Mode checkout & Key Vault |
| **Backend REST API (Render)** | https://eneba-api-ztqj.onrender.com | Go (`chi/v5` + `pgx/v5`) API connected to Neon Serverless PostgreSQL |
| **Health & DB Check** | https://eneba-api-ztqj.onrender.com/api/health | Verifies API uptime and PostgreSQL pool connectivity |

> **Render Cold-Start Note:** The backend runs on Render's free tier and may take ~20–40s to wake on the very first request after inactivity.

### Pre-Seeded Reviewer Account & Catalog Spotlight
- **Demo Credentials** (or use the one-click **Quick-fill** button on `/login`, or register your own real email to test transactional email delivery):
  - **Email:** `gamer@eneba-demo.com`
  - **Password:** `Password123!`
- **Featured Spotlight:** **Grand Theft Auto VI** (`slug: grand-theft-auto-vi`) sits at #1 in the Hero Banner & Best Sellers with 3 competing sellers (`RockstarVault`, `KeyEmpire`, `NordicKeys`) and 12 seeded activation keys ready to purchase.

---

## System Architecture

```text
+------------------------------------------+      REST JSON + JWT / Cookies     +----------------------------------------------+
|  React 18 + Vite 6 + TS + Tailwind CSS   | ---------------------------------> |  Go 1.22+ HTTP API (chi/v5 + pgx/v5)         |
|  (/frontend -> Vercel SPA)               | <--------------------------------- |  (/backend -> Docker / Render Web Service)   |
+------------------------------------------+                                    +----------------------------------------------+
                                                                                        |                   |                 |
                                                    Hosted Test Mode Checkout           |                   | HTTPS Port 443  | pgxpool (Tx + Row Locks)
                                                                                        v                   v                 v
                                                                       +---------------------+  +-------------------+  +---------------------------------------+
                                                                       | Stripe Checkout API |  | Brevo HTTPS API   |  | Neon PostgreSQL 16+ (pg_trgm)         |
                                                                       | /v1/checkout/       |  | POST /v3/smtp/    |  | 17 games, 40 offers, 123 keys,        |
                                                                       | sessions            |  | email (443)       |  | 4 homepage_blocks                     |
                                                                       +---------------------+  +-------------------+  +---------------------------------------+
```

```mermaid
graph LR
    FE["React 18 + Vite + TS + Tailwind\n(Vercel: eneba-project-lime.vercel.app)"] -->|"REST API + JWT / Cookies\n(/api/homepage, /api/products, /api/orders)"| API["Go REST API (chi/v5 + pgx/v5)\n(Render: eneba-api-ztqj.onrender.com)"]
    API -->|"GIN pg_trgm Search\nJSONB Hydration\nFOR UPDATE SKIP LOCKED"| DB[("Neon PostgreSQL 16+\n(pg_trgm + uuid-ossp)")]
    API -->|"STRIPE_SECRET_KEY\nSession Create & Verify"| STRIPE["Stripe Checkout\n(Test Mode)"]
    API -->|"BREVO_API_KEY\nPOST /v3/smtp/email (HTTPS 443)"| BREVO["Brevo Transactional\nEmail API"]
```

---

## End-to-End Purchase & Security Flow

1. **Discovery & Fuzzy Search (`/`, `/store`):**
   - Homepage sections (`hero_banner`, `best_sellers`, `flash_deals`, `recommended`) are dynamically driven by PostgreSQL `homepage_blocks` JSONB records and hydrated in a single batched CTE query.
   - Storefront filtering combines typo-tolerant `pg_trgm` full-text/trigram ranking (`?q=cybrpunk`), multi-select `platform` & `region` filters, `min_price`/`max_price` bounds, and custom sorting.
2. **Multi-Seller Comparison & Persistent Cart (`/product/:slug`, `/cart`):**
   - Buyers compare competing sellers by price, discount %, rating, review count, and live key stock. Cart and Wishlist persist in `localStorage` with stock clamping.
3. **Authentication (`/login`, `/register`):**
   - Supports account creation and sign-in with `bcrypt` password hashing and HS256 JWT tokens returned in JSON and cross-site `HttpOnly` cookies (`SameSite=None; Secure` over HTTPS).
4. **Stripe Checkout (Test Mode) & Atomic Key Fulfillment (`/checkout`, `/checkout/success`):**
   - Calls `POST /api/checkout/stripe-session` with server-authoritative EUR prices and cart `metadata.items_json` (falling back to simulated card payment when `STRIPE_SECRET_KEY` is omitted).
   - `POST /api/orders/checkout` verifies payment with Stripe idempotently (`orders.stripe_session_id`), locks exact key rows via `SELECT ... FROM digital_keys ... FOR UPDATE SKIP LOCKED`, marks keys `SOLD`, and commits—or rolls back cleanly with `409 Conflict` if stock runs out.
5. **Brevo Masked Security Email & Key Vault Reveal (`/orders/:id`):**
   - Sends an Eneba-styled HTML email asynchronously via **Brevo's HTTPS API (`POST https://api.brevo.com/v3/smtp/email`)** over port 443 (prioritized ahead of SMTP because Render's free tier blocks outbound port 587).
   - For security, emails never contain raw keys in plaintext—items show `••••-••••-••••` (*Key ready in your account*) alongside a **"CLICK TO SEE KEY"** button linking directly to `/orders/:id`, where users click **"Click to See Key"** to reveal and copy their activation code.

---

## Key Engineering Highlights

- **Concurrency-Safe Key Allocation (`backend/internal/repository/orders.go`):** Merges duplicate cart lines, sorts offers deterministically by `seller_offer_id` to prevent lock-order deadlocks, and uses PostgreSQL row-level `FOR UPDATE SKIP LOCKED` inside an atomic transaction (tested under 8-way concurrent buyer load).
- **Resilient Production API & CORS Plumbing (`frontend/src/api/client.ts`, `frontend/vercel.json`, `backend/internal/middleware/cors.go`):** Frontend resolves `VITE_API_URL` / `VITE_API_BASE_URL` cleanly with a Render production fallback and Vercel `/api/:path*` proxy rewrites; backend validates single redirect URLs (`CleanFrontendURL`) and allows `https://*.vercel.app` origins alongside configured allowlists.
- **Prioritized Multi-Transport Email Pipeline (`backend/internal/services/email.go`):** Evaluates `BREVO_API_KEY` (`api.brevo.com/v3/smtp/email` over HTTPS 443) **first**, falling back to STARTTLS SMTP (`587`/`465`) only when `BREVO_API_KEY` is empty, then Resend, then structured `[EMAIL PREVIEW]` stdout logs.

---

## Project Directory Tree

```text
Eneba Project/
├── AGENT_LOG.md                   # Complete chronological prompt & change log (Turns 1–34)
├── README.md                      # Submission architecture, setup & live links guide
├── docker-compose.yml             # Local PostgreSQL 16 service
├── render.yaml                    # Render Blueprint for Go backend deployment
├── neon.ts                        # Neon Postgres project binding metadata
├── .env.example                   # Root environment template (clean placeholders)
├── backend/
│   ├── .env.example               # Backend environment template
│   ├── Dockerfile                 # Multi-stage Linux/amd64 Go container build
│   ├── go.mod / go.sum
│   ├── cmd/
│   │   ├── api/main.go            # HTTP server entrypoint, startup sync & graceful shutdown
│   │   └── migrate/main.go        # Unpooled Postgres DDL/seed runner for Neon & local DBs
│   ├── migrations/
│   │   ├── 001_init.sql           # Extensions (pg_trgm, uuid-ossp), schema & GIN indexes
│   │   └── 002_seed.sql           # 17 games (GTA VI #1), 40 offers, 123 keys, 4 blocks, 2 demo users
│   └── internal/
│       ├── auth/                  # HS256 JWT generation & validation
│       ├── config/                # Env sanitization, URL validation & CORS origin builder
│       ├── db/                    # pgxpool Neon-compatible (simple protocol for -pooler) setup
│       ├── handlers/              # REST handlers + 18 Go integration & unit tests
│       ├── middleware/            # Bearer/cookie JWT auth & Vercel/localhost CORS middleware
│       ├── models/                # Domain & API DTO definitions
│       ├── repository/            # pg_trgm search, batch hydration & SKIP LOCKED checkout
│       ├── router/                # Chi router & protected/public routes
│       └── services/              # Catalog sync, Stripe Test Mode client & Brevo/SMTP/Resend emailer
└── frontend/
    ├── .env.example               # Frontend VITE_API_BASE_URL / VITE_API_URL template
    ├── vercel.json                # API proxy rewrite + SPA fallback rules
    ├── package.json
    ├── tailwind.config.js         # Eneba violet / cyber-yellow / teal design tokens
    ├── scripts/run-tests.mjs      # esbuild + Node test harness (15 frontend tests)
    ├── tests/purchaseFlow.test.mjs
    └── src/
        ├── api/client.ts          # Typed fetch client, error handling & prod URL resolution
        ├── components/            # Navbar, SearchBar, ProductCard, CustomSelect, HeroBanner, OrderKeyCard
        ├── context/               # AuthContext, CartContext, WishlistContext
        ├── pages/                 # HomePage, StorePage, ProductPage, CartPage, AuthPage, CheckoutPage, Orders
        ├── types/api.ts           # TypeScript API contracts matching Go structs
        └── utils/                 # Price/date formatters, redirect sanitization & block parsers
```

---

## Local Setup & Automated Test Suite

### Prerequisites
- **Go** `1.22+`
- **Node.js** `20+` and **npm**
- **PostgreSQL** `16+` (Docker Compose, local Postgres, or Neon)

### 1. Configure Environment Templates
Copy the example templates (no `.env` files or secret keys are tracked in git):
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Key variables in `backend/.env` and `frontend/.env`:
- `DATABASE_URL` — PostgreSQL connection string (e.g., local Docker `postgres://eneba_user:eneba_password@localhost:5432/eneba_marketplace?sslmode=disable` or Neon `?sslmode=require`)
- `JWT_SECRET` — Signing secret for HS256 tokens (32+ chars in production)
- `FRONTEND_URL` — Frontend base URL for Stripe return redirects and email CTA links (`http://localhost:5173` locally)
- `STRIPE_SECRET_KEY` — Optional Stripe Test Mode key (`sk_test_...`); leave blank to use the built-in simulated payment mode
- `BREVO_API_KEY` & `SMTP_FROM` — Optional Brevo API key (`xkeysib-...`) and verified sender address for HTTPS port 443 email delivery; leave blank for `[EMAIL PREVIEW]` stdout logs
- `VITE_API_BASE_URL` — Frontend API URL (`http://localhost:8080` for local Vite dev or proxy)

### 2. Start PostgreSQL & Seed the Database
```bash
# Option A: Start local PostgreSQL 16 via Docker Compose (auto-runs migrations on fresh volume)
docker-compose up -d postgres

# Option B: Apply migrations directly against any local or Neon PostgreSQL database
cd backend
go run ./cmd/migrate
```

### 3. Run Backend Tests & API Server
The Go suite (`18` integration & unit tests) verifies health checks, dynamic CMS block hydration, **Grand Theft Auto VI** spotlight & catalog ordering, `pg_trgm` fuzzy search, multi-platform/region/price filtering, concurrent `FOR UPDATE SKIP LOCKED` checkout safety, Stripe session creation/verification/idempotency, CORS origins, masked key HTML emails, and prioritized Brevo HTTPS API delivery:
```bash
cd backend
go test -v -count=1 ./...
go run ./cmd/api
```
Backend API listens on `http://localhost:8080`.

### 4. Run Frontend Tests, Build & Dev Server
The frontend test suite (`15` tests) verifies `cartReducer` stock clamping, `CartPage`, auth redirects on `CheckoutPage` and `OrdersPage`, masked `OrderKeyCard` reveal UX, `OrderDetailPage`, and production API URL resolution:
```bash
cd frontend
npm install
npm test
npm run build
npm run dev
```
Storefront runs on `http://localhost:5173`.

---

## AI-Assisted Development Log

Every user prompt, implementation plan, architectural decision, code change, and test run across the project lifecycle is documented chronologically in [**`AGENT_LOG.md`**](./AGENT_LOG.md).
