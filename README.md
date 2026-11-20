# Three Eagles Ltd - Internal Toolbox Talk (TBT) Web App
### Cloudflare Pages + Cloudflare D1 (£0 Free Tier Stack)

A mobile-first, zero-cost internal web application for conducting and logging digital Toolbox Talks (TBTs) with statutory UK legal defensibility, 4-digit operative PIN authentication, stroke-distance validated mobile signatures, comprehension verification, weekly briefing cycle tracking, and official A4 sign-off register generation.

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
├── .dev.vars.example          # Sample environment variables template
├── .gitignore                 # Excludes .wrangler, node_modules, logs
├── README.md                  # Complete operations and deployment guide
├── migrations/
│   ├── 0001_init.sql          # Schema: operatives, tbts, signoffs, audit indexes
│   ├── 0002_seed.sql          # Seed data: AVC032, AVC011, AVC022, AVC024 & site operatives
│   └── 0003_security_and_weekly.sql # PIN column, briefing_week, unique weekly signoff index
├── functions/
│   └── api/
│       ├── _middleware.js     # CORS headers, security headers, global error handling
│       ├── operatives.js      # Operative listing and dynamic starter onboarding (PIN hidden)
│       ├── tbts.js            # TBT material retrieval & structured safety content
│       ├── signoff.js         # Legal validation: PIN auth, scroll check, quiz check, weekly duplicate check
│       └── admin.js           # Supervisor dashboard, PIN resets, cycle updates, WhatsApp reminders
└── public/
    ├── index.html             # Mobile-first operative sign-off interface (dynamic TBTs & PIN)
    ├── admin.html             # Supervisor compliance portal & printable A4 register
    ├── styles.css             # AIM branding, responsive layout, @media print A4 stylesheet
    ├── app.js                 # Touch signature pad (anti-tap stroke check), scroll tracker, PIN validation
    └── admin.js               # Strict header PIN auth, live metrics, WhatsApp reminder copy, PIN resets
```

---

## 3. UK Legal Defensibility & Security Architecture

1. **Mandatory Full Content Review (Scroll Gate):**
   - The `<div id="tbt-content-container">` tracks user scrolling via real-time scroll listeners and an `IntersectionObserver` attached to a sentinel element at the bottom.
   - Operatives cannot access the comprehension question, operative selector, or signature canvas until they have scrolled through the entire talk.
   - The server strictly enforces `scrolled_to_bottom === true` in `functions/api/signoff.js`.

2. **Comprehension Knowledge Gate:**
   - Each TBT has an embedded check question (e.g. for AVC032: *"When should you carry out a Pre-use check on a ladder?"*).
   - The digital signature pad remains locked until the operative selects the correct answer.
   - The server validates the submitted answer index against the canonical answer stored in D1.

3. **Operative 4-Digit PIN Security:**
   - Operatives must enter their 4-digit PIN (default `1234`) to authenticate their identity.
   - The server validates `operative.pin === submitted_pin` and returns HTTP 401 if incorrect.
   - Operative PINs are never exposed in public `GET /api/operatives` calls.
   - Supervisors can view and reset any operative's PIN from the Supervisor Portal (`admin.html`).

4. **Digital Signature Pad & Anti-Tap Stroke Validation:**
   - HTML5 `<canvas>` with native pointer events (`pointerdown`, `pointermove`, `pointerup`) with `touch-action: none` for smooth mobile finger/stylus drawing.
   - Tracks stroke distance (`Math.hypot`) and point count so single-tap dots or blank taps cannot submit.
   - The server validates a minimum PNG base64 length (>= 500 characters).

5. **Weekly Briefing Cycles & Unique Constraint:**
   - Each TBT tracks an active `briefing_week` label (e.g. `Week 1`, `Week 2`).
   - A unique database index `idx_unique_weekly_signoff` prevents duplicate sign-offs by the same operative for the same talk in the same cycle (HTTP 409).
   - Supervisors can advance a talk's cycle (e.g. to `Week 2`) to start a fresh sign-off cycle while keeping all historical records intact.

6. **Outstanding Operatives & WhatsApp Reminder:**
   - Supervisors can view active operatives who have NOT yet completed sign-off for the active briefing week.
   - 1-click **"Copy Reminder List (WhatsApp)"** generates a ready-to-paste message with the list of pending operatives and the sign-off link.

7. **Official A4 Printable Register (Save as PDF):**
   - Located on the Supervisor Portal (`admin.html`).
   - Renders the exact 4-column sign-off table from Page 5 of the AIM PDF: `Date | Name | Signature | Company`.
   - Embeds the captured digital signature images directly into the table.
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
   npm run migrate:local
   ```
   *(runs `npx wrangler d1 migrations apply tbt-db --local`)*
3. Start the local Pages development server:
   ```bash
   npm run dev
   ```
   *(runs `npx wrangler pages dev public --d1=DB=d1-tbt-db-production --port=8788`)*
4. Open your browser:
   - **Operative App:** [http://127.0.0.1:8788](http://127.0.0.1:8788)
   - **Supervisor Portal:** [http://127.0.0.1:8788/admin.html](http://127.0.0.1:8788/admin.html) *(PIN: `2026`)*

---

## 5. Free-Tier Cloudflare Deployment Guide

### Step 1: Create Remote D1 Database
```bash
npx wrangler d1 create tbt-db
```

### Step 2: Update `wrangler.jsonc`
Ensure `database_id` in `wrangler.jsonc` matches your created database:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "tbt-db",
    "database_id": "89224256-b09c-43b0-89cb-333bcbbcaf78",
    "migrations_dir": "migrations"
  }
]
```

### Step 3: Run Remote Migrations
```bash
npm run migrate:remote
```

### Step 4: Deploy to Cloudflare Pages
```bash
npm run deploy
```
*(runs `npx wrangler pages deploy public`)*

Live URL: `https://tbt-app-5tv.pages.dev`
