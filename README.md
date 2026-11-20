# Three Eagles Ltd - Internal Toolbox Talk (TBT) Web App
### Cloudflare Pages + Cloudflare D1 (£0 Free Tier Stack)

A mobile-first, zero-cost internal web application for conducting and logging digital Toolbox Talks (TBTs) with statutory UK legal defensibility, mobile signature capture, comprehension verification, and official A4 sign-off register generation.

---

## 1. Project Overview & Architecture

- **Hosting & Compute:** Cloudflare Pages + Pages Functions (`/functions/api/*.js`)
- **Database:** Cloudflare D1 SQLite (`tbt-db`) via `env.DB` binding
- **Frontend:** Vanilla HTML5, CSS3, and ES6+ JavaScript (`/public`) — no bundlers or Node runtime needed on the client
- **Cost:** £0.00 / month (100% within Cloudflare Free Tier limits: 100k requests/day, 5M D1 reads/day, 100k writes/day, 500 Pages builds/month)
- **Defensibility Compliance:** Health and Safety at Work etc. Act 1974 & Work at Height Regulations 2005

---

## 2. Directory Structure

```text
tbt-app/
├── package.json               # Scripts for dev, migrations, and deployment
├── wrangler.jsonc             # Cloudflare Pages & D1 binding configuration
├── .dev.vars                  # Local environment secrets (ADMIN_PIN, SITE_NAME)
├── .gitignore                 # Excludes .wrangler, node_modules, logs
├── README.md                  # Complete operations and deployment guide
├── migrations/
│   ├── 0001_init.sql          # Schema: operatives, tbts, signoffs, audit indexes
│   └── 0002_seed.sql          # Seed data: AVC032, AVC011, AVC022, AVC024 & site operatives
├── functions/
│   └── api/
│       ├── _middleware.js     # CORS headers, security headers, global error handling
│       ├── operatives.js      # Operative listing and dynamic starter onboarding
│       ├── tbts.js            # TBT material retrieval & structured safety content
│       ├── signoff.js         # Legal validation: scroll check, quiz check, immutable signoff
│       └── admin.js           # Supervisor dashboard, stats, CSV export, register generation
└── public/
    ├── index.html             # Mobile-first operative sign-off interface
    ├── admin.html             # Supervisor compliance portal & printable A4 register
    ├── styles.css             # AIM branding, responsive layout, @media print A4 stylesheet
    ├── app.js                 # Touch signature pad, scroll tracker, quiz gating logic
    └── admin.js               # PIN auth, real-time metrics, register table, CSV exporter
```

---

## 3. UK Legal Defensibility Implementation

1. **Mandatory Full Content Review (Scroll Gate):**
   - The `<div id="tbt-content-container">` tracks user scrolling via high-frequency scroll listeners and an `IntersectionObserver` attached to a sentinel element at the bottom.
   - Operatives cannot access the comprehension question, operative selector, or signature canvas until they have scrolled through the entire talk.
   - The server strictly enforces `scrolled_to_bottom === true` in `functions/api/signoff.js` before accepting a submission.

2. **Comprehension Knowledge Gate:**
   - Each TBT has an embedded check question (e.g. for AVC032: *"When should you carry out a Pre-use check on a ladder?"*).
   - The digital signature pad remains locked until the operative selects the correct answer.
   - Server validates the submitted answer index against the canonical answer stored in D1.

3. **Digital Signature Pad:**
   - HTML5 `<canvas>` with native `PointerEvent` handling, supporting touchscreens (phones, tablets, iPads) and stylus/mouse input.
   - Uses device pixel ratio scaling (`window.devicePixelRatio`) to produce crisp, high-resolution signature drawings.
   - Exports high-fidelity PNG base64 data URLs (`data:image/png;base64,...`).

4. **Questions, Hazards & Notes (Mirrors Official Template):**
   - Mirrors the notes box on Page 4 of the official AIM TBT document.
   - Records any hazard or site query raised during the briefing.

5. **Immutable Audit Snapshot:**
   - Each submission permanently records: `tbt_id`, `doc_code`, `tbt_title`, `doc_owner`, `last_revision` (`LR`), `next_revision` (`NR`), `operative_id`, `operative_name`, `operative_company`, UTC timestamp, client IP, browser user agent, and signature image.
   - Duplicate submissions for the same operative on the same day are rejected (HTTP 409).

6. **Official A4 Printable Register (Save as PDF):**
   - Located on the Supervisor Portal (`admin.html`).
   - Renders the exact 4-column sign-off table from Page 5 of the AIM PDF: `Date | Name | Signature | Company`.
   - Embeds the captured digital signature images directly in the table.
   - Uses `@media print` rules formatted for A4 portrait with official headers and footers for instant printing or browser "Save as PDF".

---

## 4. Local Development

### Prerequisites
- Node.js (v18+)

### Steps
1. Navigate to the project directory:
   ```bash
   cd tbt-app
   ```
2. Apply local database migrations:
   ```bash
   npx wrangler d1 migrations apply tbt-db --local
   ```
3. Start the local Pages development server:
   ```bash
   npx wrangler pages dev public --d1=DB=d1-tbt-db-production --port=8788
   ```
4. Open your browser:
   - **Operative App:** [http://127.0.0.1:8788](http://127.0.0.1:8788)
   - **Supervisor Portal:** [http://127.0.0.1:8788/admin.html](http://127.0.0.1:8788/admin.html) (Default PIN: `2026`)

---

## 5. Free-Tier Cloudflare Deployment Guide

### Step 1: Create Remote D1 Database
```bash
npx wrangler d1 create tbt-db
```
Wrangler will output your database ID:
```text
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 2: Update `wrangler.jsonc`
Replace `"d1-tbt-db-production"` in `wrangler.jsonc` with the `database_id` generated above:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "tbt-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "migrations_dir": "migrations"
  }
]
```

### Step 3: Run Remote Migrations
```bash
npx wrangler d1 migrations apply tbt-db --remote
```

### Step 4: Create & Deploy Cloudflare Pages Project
```bash
npx wrangler pages project create tbt-app --production-branch main
```

### Step 5: Bind D1 Database in Cloudflare Dashboard
1. Go to **Cloudflare Dashboard** -> **Workers & Pages** -> **tbt-app**.
2. Go to **Settings** -> **Functions** -> **D1 database bindings**.
3. Click **Add binding**:
   - Variable name: `DB`
   - D1 database: `tbt-db`
4. Under **Environment variables**, set:
   - `ADMIN_PIN`: `2026` (or your chosen secure PIN)
   - `SITE_NAME`: `AGC South Site (Three Eagles Ltd)`

### Step 6: Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy public
```
Your web app is now live at:
`https://tbt-app.pages.dev`
