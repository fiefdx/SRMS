# Assignment 2 — Node.js + Express + MySQL backend

Repository: <https://github.com/fiefdx/SRMS> · backend lives in [`server/`](../server), the Assignment 1
React frontend in [`client/`](../client).

```
curl http://localhost:4000/api          # the API lists its own endpoints
```

---

## 1. Running it

```bash
cd server
cp .env.example .env          # set JWT_SECRET and the MySQL credentials
npm install

npm run migrate               # create the database and the 7 tables
npm run seed                  # demo users, 24 dishes, 6 tables, orders, bookings, feedback
   – or –
npm run db:reset              # drop everything and rebuild (handy before a demo)

npm run dev                   # http://localhost:4000 (nodemon)
npm test                      # 104 tests, node:test + supertest against a throwaway srms_test database
npm run lint                  # oxlint
```

Seeded logins (password `demo1234`): `admin@srms.dev` (administrator) and `demo@srms.dev` (customer).
`GET /api/health/db` reports whether the database is reachable, which is the first thing to check.

---

## 2. Structure and request lifecycle

```
server/
  scripts/            migrate.js, seed.js            command-line wrappers
  src/
    app.js            Express app factory (also used by the tests)
    index.js            starts the HTTP server, closes pools on SIGINT
    config/env.js     every setting comes from one place (.env)
    db/               schema.sql, pool.js, migrate.js, seed.js, seedData.js
    routes/           one router per resource: URL + which middleware guards it
    validation/       zod schemas: what a request may contain
    middleware/       auth, validate, requestLogger, notFound, errorHandler
    controllers/      HTTP only: read the request, call a service, set the status
    services/         the business rules (orders, menu, reservations, users, admin, ai)
    mappers/          database row → the JSON shape the client expects
    utils/            ApiError, asyncHandler
  tests/              10 files, one per area
```

A request travels through the same layers every time:

```
POST /api/orders
  → route            orderRoutes.js   decides who may try (optionalAuthenticate) and validates the body
  → validate        middleware/validate.js   zod parses body/params/query, or 422 immediately
  → controller      orderController.js  no logic, just req.valid → service → 201
  → service         orderService.js     prices from the database, checks the rules, one transaction
  → mapper          mappers/order.js    snake_case rows → camelCase JSON
  → errorHandler    anything thrown becomes { "error": { "code", "message", "details?" } }
```

The point of splitting it this way is that the rules live in exactly one place. `POST /api/orders` and
`PATCH /api/orders/:id/items` both recalculate the money through the same `pricing.js`, and the reservation
rules are identical for a table booking and a corporate event because both go through
`reservationService.js`.

---

## 3. Data model

`server/src/db/schema.sql` — MySQL 8, InnoDB, `utf8mb4`.

| Table | Holds | Notable constraints |
| --- | --- | --- |
| `users` | customers and administrators | `UNIQUE(email)`, `role CHECK (customer, admin)`, bcrypt hash never leaves the API |
| `menu_items` | the menu | `category`, `price DECIMAL(8,2)`, allergens/dietary tags/ingredients as JSON, `available`, `today_special`, `popularity` |
| `restaurant_tables` | the physical room | `seats`, `area (main, window, group)` |
| `orders` | one order | `user_id NULL` (guest orders), contact columns for guests, `CHECK (user_id IS NOT NULL OR email IS NOT NULL)`, status enum |
| `order_items` | the basket, as it was at the time | `name`/`unit_price` snapshots, `line_total DECIMAL(10,2) AS (unit_price * quantity) STORED`, `ON DELETE SET NULL` on the menu link |
| `reservations` | table bookings **and** special events | `type (standard, birthday, corporate, group)`, `INDEX(date, start_time)` for availability, guest contact columns |
| `feedback` | ratings and comments | `rating 1–5`, `sentiment NULL` until analysed, `UNIQUE(order_id)` — one review per order |

Design decisions worth mentioning in the demo:

* **Prices are stored as `DECIMAL`, totals as generated columns.** Money is never a floating point number, and
  `line_total` cannot disagree with `unit_price * quantity`.
* **Order lines keep a copy of the dish name and price.** Deleting a dish from the menu (`ON DELETE SET NULL`)
  must not rewrite last Tuesday's receipt.
* **Events are not a second table.** A corporate booking is a reservation with `type = 'corporate'`, so the
  double-booking guard, the opening-hours rule and the table capacity rule apply to both for free.
* **Popularity is derived**, never entered: `UPDATE menu_items SET popularity = (SELECT … FROM order_items …)`.
* **Guests are first-class.** `user_id` is nullable, and a guest order/booking stores the name, email and phone
  it was placed with; the `CHECK` guarantees an order is always attributable to one or the other.

---

## 4. Authentication, sessions and roles

* `POST /api/auth/register` hashes the password with **bcrypt** (cost 10) and returns a **JWT** (`jsonwebtoken`,
  HS256, `JWT_SECRET`, default 8h expiry) — the session stays alive across refreshes without re-authenticating,
  which is what the brief asks for under "session management".
* `authenticate` reads `Authorization: Bearer <token>`, verifies it and puts `{ id, role, email }` on `req.user`;
  a bad or expired token is a 401 with the same envelope as every other error.
* `optionalAuthenticate` is used where a guest is allowed (browsing is always open; placing an order or booking a
  table works without an account, and the response then carries the contact details instead of a user id).
* `requireAdmin`, and `requireSelfOrAdmin()` for profile and order access:

| Action | guest | customer | admin |
| --- | --- | --- | --- |
| browse the menu, ask the assistant | ✔ | ✔ | ✔ |
| place an order / book a table | ✔ (contact details) | ✔ | ✔ |
| read an order | only own guest order, by reference + email | only own orders | all orders |
| change an order's status | ✘ | ✘ (only cancel) | ✔ (kitchen workflow) |
| change the menu | ✘ | ✘ | ✔ |
| read a profile | ✘ | own only | any |
| statistics, feedback, user list | ✘ | ✘ | ✔ |

`GET /api/users/:userId` answers **403** rather than 404 for another customer's profile — the order rules do the
same (`"You can only read your own orders"`), and the Postman *Errors* folder shows both. A 404 is reserved for
ids that genuinely do not exist, so the API never confirms that something is there while refusing to show it.
Deleting your own account is a 400, and deleting the **last** administrator is a 409, so the API can never lock
itself out.

---

## 5. Validation and error handling

Every write goes through a **zod** schema in `src/validation/`. Schemas are `.strict()`, so an unexpected key is
refused — which is also the reason a client cannot smuggle its own `total` into an order.

```http
PATCH /api/orders/7/status
{ "status": "delivered" }

409 Conflict
{ "error": { "code": "INVALID_STATUS_TRANSITION",
             "message": "An order cannot go from pending to delivered",
             "details": { "from": "pending", "allowed": ["preparing", "cancelled"] } } }
```

The `message` is written for a person and may be reworded; the **`code` is stable**, so the React client can
switch on it (the two most useful ones: `TABLE_ALREADY_BOOKED`, which comes with the reference it clashes with,
and `INVALID_STATUS_TRANSITION`, which comes with the states the order may go to next).

| Status | `error.code` | Used for |
| --- | --- | --- |
| 400 | `BAD_REQUEST`, `INVALID_JSON` | the request is understood but cannot be carried out (deleting your own account), a body that is not JSON |
| 401 | `UNAUTHORIZED` | no token, bad token, wrong password |
| 403 | `FORBIDDEN` | signed in but not allowed (customer on an admin route, another customer's profile) |
| 404 | `NOT_FOUND` | no such dish, order, booking or route |
| 409 | `CONFLICT`, `TABLE_ALREADY_BOOKED`, `INVALID_STATUS_TRANSITION`, `NO_TABLE_AVAILABLE`, `DUPLICATE_VALUE` | the state does not allow it: double booking, skipped workflow step, no table big enough, duplicate email |
| 413 | `PAYLOAD_TOO_LARGE` | a body over the limit |
| 422 | `VALIDATION_FAILED`, `CART_NOT_ORDERABLE` | field-level validation, or dishes that are not on the menu / sold out — `details[]` names the field and what was wrong |
| 500 | `INTERNAL_ERROR` | an unexpected failure: logged with a stack trace, never shown to the client |
| 503 | `SERVICE_UNAVAILABLE` | the database is unreachable or refuses the credentials |

`src/middleware/errorHandler.js` also catches unexpected failures: the message is logged with the request id, and
the client gets a generic 500 instead of a stack trace. `asyncHandler` means no service has to remember
`try/catch`.

Examples of rules enforced *after* validation, because they need the database: the dish must exist and be
available; the quantity must be ≥ 1 (in the schema) and the price is looked up rather than trusted; a booking
must fall inside the opening hours, on a day the restaurant is open, for a table that seats the party, and must
not clash with an existing booking.

---

## 6. Business rules to show in the demo

* **The client never decides the money.** `POST /api/orders` takes ids and quantities; `services/pricing.js`
  adds the 9% tax, the $3.50 delivery fee and free delivery over $40. The `total` a browser sends is rejected as
  an unknown field (see the Postman *Errors* folder).
* **The order workflow**: `pending → preparing → ready → delivered`, with `cancelled` reachable from
  `pending`/`preparing`. Skipping a step is a 409, and the allowed next steps come back in `details` so the UI
  can draw the timeline.
* **No double booking.** `reservationService.js` opens a transaction, `SELECT … FOR UPDATE` locks the candidate
  rows, checks the overlap and only then inserts. Two simultaneous requests cannot both win — the collection's
  "book the same table again" request demonstrates the 409.
* **Guest access** is scoped: a guest order is readable with the reference **plus** the email it was placed with,
  and an order that belongs to an account is never released by an email match alone.
* **Cancelled orders do not count as revenue**, and they do not make a dish popular — the admin tests assert this
  against the seed data.

---

## 7. AI features

* `POST /api/ai/ask` — the menu assistant. It recognises the intent, then **queries the database** for the
  answer: today's special comes from `menu_items.today_special`, the recommendation is ranked from real
  `order_items` quantities, "what did I order last time?" reads the signed-in customer's latest order, a booking
  question is answered with a genuinely free table. Anything it cannot resolve returns an honest fallback with the
  suggested questions instead of an invented answer.
* `POST /api/admin/feedback/analyze` — sentiment analysis of customer feedback (the optional 5-point bonus).
  A local, explainable classifier: the star rating dominates, a food-service lexicon breaks ties, and each verdict
  reports the matched words and the reason. Labels are written to `feedback.sentiment`; re-running only touches
  rows that are still `NULL` unless `force` is sent.
* `GET /api/admin/feedback/summary` — a short written brief. With `?provider=ai` and `OPENAI_API_KEY` set, an
  OpenAI-compatible model writes it; with no key, or if the call fails, the local brief is returned and the
  response says why. No endpoint depends on the network.

---

## 8. Tests

```bash
npm test        # 104 tests, run with --test-concurrency=1 so the schemas do not race
```

| File | Covers |
| --- | --- |
| `api.test.js` | the app factory, the endpoint index, the error envelope (a stable `code` for every failure), request logging, health, CORS |
| `db.test.js` | the schema itself: keys, foreign keys, CHECK constraints, generated column, JSON round trip, DATE/TIME handling |
| `pricing.test.js` | tax, delivery fee, free-delivery threshold, cancelled/empty carts |
| `auth.test.js` | register/login, bcrypt, JWT expiry and tampering, duplicate email, role separation |
| `users.test.js` | profile rules, favourites, admin listing/search, last-admin protection, deletion |
| `menu.test.js` | SQL filters and facets, admin CRUD, daily-special uniqueness, sold-out dishes and order snapshots |
| `orders.test.js` | server-side totals, guest vs account orders, the status workflow, feedback |
| `reservations.test.js` | opening hours, capacity, availability, double booking (including two concurrent requests), events |
| `admin.test.js` | the reporting arithmetic, cancelled orders excluded, figures move when an order arrives |
| `ai.test.js` | the six required assistant questions, ownership of personal answers, sentiment round trip |

The tests run against `srms_test`, created and migrated by the test file itself; if MySQL is not running they
skip with a clear message rather than failing obscurely.

---

## 9. Postman (5% of the grade)

There are **two collections**, and that is deliberate:

| File | Requests | Use |
| --- | --- | --- |
| `SRMS-demo.postman_collection.json` | 14 | what you put on screen — one request per point in the demo script, numbered 01-14 |
| `SRMS.postman_collection.json` | 83 | the evidence — every advertised endpoint (48), including the boring guards |

The demo collection is **re-recordable**: a collection pre-request script works out the next day the restaurant
is open and books the first table the availability query says is free, so a second take of the video does not
clash with the first. The full collection uses fixed dates in 2030, so it does need `npm run db:reset` first.

Files: [`docs/postman/SRMS.postman_collection.json`](postman/SRMS.postman_collection.json) and
`SRMS.postman_environment.json` — 83 requests in 10 folders, covering **every endpoint the API advertises**
(48 of them). Every request has a test script; verified end to end against the running API, all 83 return the
status, message and `error.code` their scripts expect.

### Set up (once)

```bash
cd server && npm run db:reset && npm run dev      # MySQL + the API on http://localhost:4000
```

1. Postman → **Import** → drag in `SRMS.postman_collection.json` (and the environment file if you want a
   named environment; the collection already defines its own variables, so this is optional).
2. Select the collection and open the **Variables** tab: `baseUrl` is `http://localhost:4000/api` — change only
   that if the API runs somewhere else.
3. Run **00 Health & discovery → Database readiness** first: it should report `"database": "connected"`.

### Running it

For the presentation, import `SRMS-demo…json` and either press **Run collection** or send them one at a time
while talking: `01 health → 02/03 log in → 04 menu filters → 05 place an order → 06 refuse a made-up total →
07 refuse a skipped kitchen step → 08/09/10 availability, booking, double-booking clash → 11/12 the assistant →
13 the dashboard, which already counts the order and the booking from 05 and 09 → 14 the same menu POST as a
customer: 403`.

Run the full collection **top to bottom** — it feeds itself:

| Folder | What it proves |
| --- | --- |
| 01 Auth | the two logins store `customerToken` / `adminToken`; registering stores `newUserId` / `newUserToken` |
| 02 Menu | browsing and SQL filters; an admin creates a dish, edits it, deletes it (`menuItemId`) |
| 03 Users | own profile and favourites, admin listing, the role and deletion guards |
| 04 Orders | server-side totals, `orderId` / `orderReference` captured, the workflow 409, feedback |
| 05 Reservations | availability, a booking (`reservationId`, `tableId`), then the same slot again → 409 |
| 06 Special events | an event request (`eventId`), notes while pending, approval, then the 409 for editing an approved booking |
| 07 Admin reporting | the figures, and the arithmetic test that the status breakdown adds up to the headline |
| 08 AI | the assistant questions and the sentiment pass |
| 09 Errors | the one error envelope: 401 / 403 / 404 / 409 / 422 |

**Before a full re-run: `npm run db:reset`.** Folders 05 and 06 book fixed dates in 2030, so the bookings from
the previous run are still in the way and the first booking request would legitimately fail with a clash.

**If a guarded request returns 401**, the token has expired (8 h) or you skipped 01 — run *Log in (customer)*
and *Log in (admin)* again. The Authorization header is set per request as `Bearer {{customerToken}}` or
`Bearer {{adminToken}}`, so you can see exactly which identity each call uses.

**Reading a failure:** the **Tests** tab under a response shows which assertion passed or failed, and the body
carries `{ "error": { "code", "message", "details?" } }` — switch on the code, read the message.

### Headless (handy for the video)

```bash
npx newman run docs/postman/SRMS.postman_collection.json
npx newman run docs/postman/SRMS.postman_collection.json -n docs/postman/SRMS.postman_environment.json
```

Newman runs the same test scripts, so the pass/fail counts on screen are real evidence rather than green ticks
in a GUI.

---

## 10. GitHub history

The backend was built on feature branches, each merged into `main` with `--no-ff` so the merge is visible:

| Branch | Feature |
| --- | --- |
| `feature/backend-scaffold` | Express 5 app factory, config, middleware, health endpoints, first tests |
| `feature/database-layer` | MySQL schema, pool, migrations, seed data, pricing service |
| `feature/auth-and-users` | bcrypt, JWT, roles, session handling, user management |
| `feature/menu-management` | menu browsing with SQL filters, admin CRUD, daily special |
| `feature/order-management` | orders, server-side pricing, kitchen workflow, feedback |
| `feature/reservation-management` | availability, booking transaction, special events |
| `feature/admin-analytics` | dashboard figures and feedback reporting |
| `feature/ai-integration` | assistant, sentiment analysis, optional external model |
| `feature/postman-collection` | the request collection and environment |
| `feature/api-index-completion` | the self-documented endpoint index |
| `feature/postman-coverage` | the three endpoints the collection was not yet exercising |
| `feature/error-codes` | a stable machine-readable `error.code` in every failure response |

---

## 11. Demo script for the recording

1. **Intro (1 min)** — the repository, the two halves (React client, Express server), the layered structure, why
   `services/` holds the rules.
2. **Database (2 min)** — `schema.sql` on screen: the seven tables, the foreign keys, the generated `line_total`,
   why order lines keep a price snapshot. Run `npm run db:reset` and show the seed counts.
3. **Auth & roles (2 min)** — register in Postman, show the bcrypt hash in the database and the JWT in the
   response; call an admin report as a customer (403), then as an admin (200). Explain `requireSelfOrAdmin`.
4. **Orders & validation (3 min)** — place an order, then send one with a made-up `total` and show the 422;
   show the totals recalculated from the database; skip a status step and show the 409 with the allowed steps.
5. **Reservations (2 min)** — availability query, book a table, repeat the same booking to get the 409, and open
   `reservationService.js` to point at `SELECT … FOR UPDATE` inside the transaction.
6. **Admin & AI (2 min)** — the dashboard statistics, then the assistant answering "what do you recommend?" from
   real order data, and the feedback sentiment pass.
7. **Tests & history (2 min)** — `npm test` (104 passing), one test file open to show how a rule is proven; the
   git graph with the feature branches; Newman running the Postman collection.
8. **Close (30 s)** — what is left for the final project: pointing the React client at this API instead of
   `localStorage`.

---

## 12. Deliberate limitations

* Payments and delivery are simulated, as the brief allows — no payment gateway, no courier.
* JWTs are stateless with an 8-hour expiry; there is no refresh token or server-side session store.
* The assistant is rule-based over SQL. The external model is only used for the written feedback brief, so that
  the graded behaviour does not depend on an API key.
* The React client still reads `localStorage`. Wiring it to this API is the final-project integration step.
