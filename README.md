# Quadrangle — Smart Campus Venue & Revenue Platform

A full MERN-stack implementation of the **Smart Campus Infrastructure & Resource
Monetization** brief: universities have empty venues during off-peak hours and a
manual booking process for clubs. Quadrangle turns that into a managed
marketplace — AI-priced by real demand, cleared of double-bookings automatically,
open to clubs and outside partners, with a manager/finance view of revenue.

**Stack:** Node.js + Express (REST API) · MongoDB + Mongoose · vanilla HTML/CSS/JS
frontend (native ES modules, no build step) · JWT auth · Chart.js · `qrcode` for
payment QR codes.

```
User → HTML/CSS/JS frontend → Express REST API → MongoDB
                                     ↓
                     AI service (dynamic pricing, conflict
                     detection, demand labels, slot suggestions)
```

---

## 1. Project structure

```
quadrangle/
├── server/                    Node + Express + MongoDB API
│   ├── src/
│   │   ├── config/db.js           Mongo connection
│   │   ├── models/                Mongoose schemas (User, Venue, Booking, Notification, PricingRule)
│   │   ├── middleware/            JWT auth guard, role guard, error handler
│   │   ├── services/
│   │   │   ├── pricing.service.js     Pure AI logic: dynamic pricing, demand, conflicts, slot suggestions
│   │   │   └── qrcode.service.js      Builds the UPI-style payment QR code
│   │   ├── controllers/           One file per resource
│   │   ├── routes/                One file per resource, mounted under /api/*
│   │   ├── seed/seed.js           Demo users, venues, pricing rules & sample bookings
│   │   └── index.js               App entry point — also serves the frontend statically
│   ├── test/pricing.test.js   Plain-Node assertion tests for the AI logic (no DB needed)
│   ├── package.json
│   └── .env.example
└── client/                    Static frontend served by the same Express app
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── api.js              fetch wrapper (attaches JWT, parses errors)
        ├── state.js            session + nav config
        ├── router.js           swaps #main content between views
        ├── ui.js                small render helpers (toast, modal, money/date formatting)
        ├── main.js              entry point, wires auth + router together
        └── views/                one module per screen (dashboard, venues, bookings, revenue, notifications, users, pricing)
```

Both are **one app on one port** — `server/src/index.js` mounts the API under
`/api/*` and serves `client/` as static files, so you don't need a separate
frontend server or CORS setup for local use.

---

## 2. Setup

### Prerequisites
- Node.js 18+
- A MongoDB instance — either:
  - **Local:** install MongoDB Community Server and run `mongod`, or
  - **Atlas (free tier):** create a cluster at mongodb.com/atlas and copy its connection string

### Install & configure

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/quadrangle      # or your Atlas URI
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5000
```

### Seed demo data

```bash
npm run seed
```

This clears and repopulates the database with 10 venues, 4 demo accounts (one per
role), a pricing-rules document, and ~20 sample bookings spread across the last
six weeks so the analytics dashboards have something to chart.

| Role              | Email                          | Password   |
|-------------------|---------------------------------|------------|
| Campus Admin       | admin@christuniversity.in       | admin123   |
| Facility Manager   | manager@christuniversity.in     | manager123 |
| Student Club       | club@christuniversity.in        | club123    |
| External Client    | client@example.com              | client123  |

### Run

```bash
npm start          # production
npm run dev         # auto-restart on change (nodemon)
```

Open **http://localhost:5000** — that's the whole app, frontend and API together.

### Run the logic tests

```bash
npm test
```

Runs 22 assertions against the pricing/conflict-detection/demand engine in
`pricing.service.js` — pure functions, no database required.

---

## 3. Feature coverage (mapped to the brief)

**1. User & Access Management** — register/login with JWT, 4 roles (external,
club, manager, admin), role-based dashboards and navigation, profile shown in
the sidebar.

**2. Campus Venue Management** — CRUD for venues (manager/admin), capacity,
location, in-charge person, equipment list, category, preview photo, search +
category + min-capacity filters. JPEG, PNG, WebP and GIF photos can be uploaded
up to 10 MB; files are stored under `server/uploads` and served from `/uploads`.

**3. Venue Booking** — search/filter, request/approve/reject/cancel workflow,
booking history, status badges (pending/approved/rejected/cancelled).

**4. AI/ML features** (`pricing.service.js`):
- **Dynamic pricing** — multiplier built from weekday/weekend, time-of-day slot,
  recent demand at that venue, and category popularity; weights are editable by
  the admin ("Pricing Rules" page) and applied live in the booking quote.
- **Conflict detection** — checks time-overlap against existing active bookings
  for that venue/date before a request can be submitted.
- **Suggested alternative slots** — when a conflict is found, computes the open
  gaps in that day's schedule.
- **Alternative venue recommendation** — when a conflict is found, ranks other
  venues by category match then price.
- **Demand prediction / labels** — `low` / `medium` / `high` per venue, based on
  bookings in the surrounding week, shown on venue cards and the utilisation table.
- **AI utilisation insight** — the manager dashboard surfaces the
  worst-performing venue as a plain-language nudge.

**5. Revenue & Finance Management** — price computed automatically per booking,
paid/unpaid tracking, revenue-by-venue and pending-revenue aggregation, QR-code
UPI-style payment simulation.

**6–9. Dashboards, external/student-club features, notifications** — role-scoped
views for each persona; a notification is created on submit / approve / reject /
cancel / payment, with an unread badge in the sidebar.

**10–11. Analytics & smart recommendations** — Chart.js: revenue by venue,
bookings by category, weekly booking volume, club-vs-external split, and a
utilisation table with demand outlook per venue.

**12. Admin & System Management** — user list with booking counts, venue CRUD,
booking oversight, and a live-editable pricing-rules panel.

---

## 4. API overview

All routes are under `/api` and (except `/auth/register`, `/auth/login`,
`/health`) require `Authorization: Bearer <token>`.

| Method | Route                              | Access          | Purpose |
|--------|-------------------------------------|-----------------|---------|
| POST   | /auth/register                     | public          | Create account |
| POST   | /auth/login                        | public          | Get a JWT |
| GET    | /auth/me                           | any             | Current user |
| GET    | /venues                            | any             | List/search/filter venues |
| POST   | /venues                            | manager, admin  | Create venue; optional multipart `image` file (up to 10 MB) |
| PUT    | /venues/:id                        | manager, admin  | Update venue; optional multipart `image` file (up to 10 MB) |
| DELETE | /venues/:id                        | manager, admin  | Remove venue |
| GET    | /bookings/quote                    | any             | Live AI price + conflict + suggestions |
| POST   | /bookings                          | any             | Submit a booking request |
| GET    | /bookings                          | any (scoped)    | List bookings (own, or all for manager/admin) |
| PATCH  | /bookings/:id/status                | owner / manager | approve / reject / cancel |
| PATCH  | /bookings/:id/pay                  | owner / manager | Mark paid |
| GET    | /bookings/:id/payment-qr           | owner / manager | Payment QR code (data URL) |
| GET    | /notifications                     | any             | Own notifications |
| PATCH  | /notifications/read-all            | any             | Mark all read |
| GET    | /users                             | admin           | All users + booking counts |
| GET/PUT| /pricing-rules                     | admin           | View/edit the AI pricing weights |
| GET    | /analytics/summary, /revenue-by-venue, /category-split, /weekly-volume, /role-split, /utilization | manager, admin | Dashboard data |

---

## 5. Notes & possible next steps

- Booking `date` is stored as an ISO `YYYY-MM-DD` string (not a `Date`) to keep
  the demand-window and conflict comparisons simple and readable — fine at this
  scale, worth revisiting with a real `Date` + timezone strategy for production.
- Payment is **simulated**: the QR code encodes a UPI-style deep link and
  "mark as paid" is a manual confirmation — there's no real payment gateway
  wired in (Razorpay/Stripe would be the natural next step).
- No test MongoDB could be provisioned in the environment this was built in, so
  the AI logic was verified with the included unit tests (`npm test`, DB-free)
  and the Express app was smoke-tested with the database layer mocked out.
  Run `npm run seed && npm start` against your own MongoDB for full end-to-end
  verification.
- Possible extensions: email notifications, a real payment gateway,
  recurring/multi-day bookings, and calendar export.
