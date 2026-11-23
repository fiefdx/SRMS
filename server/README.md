# SRMS backend (Assignment 2)

Node.js + Express REST API for the Smart Restaurant Management System: user accounts, menu,
orders, table reservations, event bookings, admin dashboard data and the AI menu assistant.

## Run

```bash
cd server
npm install
cp .env.example .env      # set JWT_SECRET and MYSQL_URI
npm run migrate           # create the MySQL schema (npm run migrate:fresh to rebuild it)
npm run seed              # load the demo menu, users, orders, reservations and feedback
npm run dev               # http://localhost:4000 (node --watch)
npm test                  # node:test + supertest (database tests skip themselves if MySQL is down)
npm run lint              # oxlint
```

`GET http://localhost:4000/api` returns the endpoint list and `GET /api/health` the service and
database status.

## Layout

```
server/
  src/
    app.js               Express app factory: CORS, JSON body limit, logging, routes, error handling
    index.js             starts the HTTP server, graceful shutdown on SIGINT/SIGTERM
    config/env.js        all environment configuration in one place (.env aware)
    db/                  data layer: pool.js (mysql2 pool + transactions), schema.sql, migrate.js,
                         seed.js, seedData.js
    middleware/          requestLogger, validate (zod), notFound, errorHandler, auth (added later)
    routes/              one router per resource, mounted under /api
    controllers/         request handling only: build the response, delegate logic to services
    services/            business rules (pricing, reservation availability, status flow, AI assistant)
    validation/          zod schemas per resource
    utils/               ApiError, asyncHandler, money/date helpers
  scripts/               CLI wrappers: migrate.js, seed.js
  tests/                 node:test + supertest suites (API behaviour, database design, pricing)
```

## Data model (`src/db/schema.sql`)

| Table | Purpose | Design points |
| --- | --- | --- |
| `users` | customers and administrators | unique email, `role ENUM('customer','admin')`, bcrypt password hash, dietary preferences and favourites as JSON |
| `menu_items` | the menu | unique name, `category ENUM`, price `DECIMAL(8,2)` with `CHECK (price > 0)`, ingredients/allergens/dietary tags as JSON, `available`, `today_special`, `popularity` |
| `restaurant_tables` | bookable tables | unique label, seat count with `CHECK (seats > 0)`, area |
| `orders` | one order per customer **or guest** | unique reference, status enum, fulfilment details JSON, stored subtotal/fee/tax/total, `user_id` nullable with contact name/email/phone for guests (a CHECK requires one or the other), index on `(user_id, status)` for "my orders" and on `contact_email` for the guest lookup |
| `order_items` | order lines | keeps the **name and unit price at purchase time**, `line_total` is a generated column (`unit_price * quantity`), cascade delete with the order |
| `reservations` | tables **and** event bookings, for members and guests | `type ENUM('standard','birthday','corporate','group')`, date/time/party size with checks, occasion + requirements + `menu_selection` for events, `user_id` nullable + contact columns (CHECK requires one), index on `(reservation_date, start_time)` for the availability query |
| `feedback` | customer comments | rating 1–5 checked, link to the order, `sentiment` filled by the AI feedback analysis feature |

Double booking is prevented in a transaction (`SELECT … FOR UPDATE`) rather than by a unique index,
because a cancelled booking must not keep the table blocked for that slot.

## Authentication and authorization

```
POST /api/auth/register   name, email, password (8+ chars, letter + number)  -> 201 { user, token }
POST /api/auth/login      email, password                                   -> 200 { user, token }
GET  /api/auth/me         Authorization: Bearer <token>                     -> 200 { user }
```

- Passwords are stored as **bcrypt** hashes and are never returned by the API.
- A successful sign-in returns a **JWT** (`sub` = user id). `authenticate` verifies it on every request
  and re-reads the account, so a deleted or demoted account cannot keep using an old token.
- `requireAdmin` (403 for customers) and `requireSelfOrAdmin` (customers may only touch their own
  records) provide the **role-based access** the brief asks for. The frontend hides admin controls,
  but the API is what actually refuses the request.
- A wrong email and a wrong password return the same message, so the endpoint cannot be used to
  discover which addresses have accounts.
- Demo accounts after `npm run seed`: `admin@srms.dev` (admin), `demo@srms.dev`, `ana@example.com`,
  password `demo1234`.

## User management

```
GET    /api/users/me              the signed-in profile
PATCH  /api/users/me              name, phone, address, dietary preferences, password (needs currentPassword)
GET    /api/users/me/favourites   saved favourites, expanded into menu items
PUT    /api/users/me/favourites   { itemIds: [...] } replaces the list (unknown ids -> 422)
GET    /api/users                 admin only: search (?search=&role=&limit=&offset=)
GET    /api/users/:userId         the customer themselves, or an admin
PATCH  /api/users/:userId         same, plus `role` for an admin
DELETE /api/users/:userId         admin only
```

Rules enforced in the API (`src/services/userService.js`): a customer's own update schema has no `role`
field at all, so an account cannot escalate itself; only an admin may change a role, nobody may change
their own role, and the **last administrator cannot be demoted or deleted**; a password change must
include the correct `currentPassword`; deleting an account also removes its orders and reservations
(`ON DELETE CASCADE` in the schema) and stops its token from working.

## Menu management

```
GET    /api/menu                 public: ?search=&category=&dietary=&freeFrom=&available=&todaySpecial=&sort=&order=&limit=&offset=
GET    /api/menu/facets          public: category and dietary-tag counts for the filter chips
GET    /api/menu/:itemId         public
POST   /api/menu                 admin
PATCH  /api/menu/:itemId         admin (price, availability, tags, today's special, …)
DELETE /api/menu/:itemId         admin
```

- Filtering happens **in SQL**: `LIKE` for the search box and `JSON_CONTAINS(dietary_tags, JSON_QUOTE(?))`
  for the dietary/allergen lists, so the menu page never downloads the whole menu. Sort columns come from
  a fixed map, never from the request string.
- The daily special is **unique**: marking a dish as today's special clears the previous one inside a
  transaction.
- `popularity` cannot be posted by a client — it is derived from order lines.
- Deleting a dish keeps past order lines intact: `order_items` stores the name and unit price at the time
  of sale, and only `menu_item_id` is set to null (`ON DELETE SET NULL`).

## Order management

```
POST   /api/orders                        customer or guest (a guest must give name + email)
GET    /api/orders                        ?status=&search=&order=&limit=&offset=
GET    /api/orders/reference/:reference   the receipt lookup (+ ?email= for a guest order)
GET    /api/orders/:orderId               owner or admin
PATCH  /api/orders/:orderId/items         owner while the order is pending, or an admin
PATCH  /api/orders/:orderId/status        admin moves it along the flow; the owner may cancel while pending
POST   /api/orders/:orderId/feedback      owner or admin, one review per order
```

- **Prices are never taken from the request.** The client sends dish ids and quantities; the lines and the
  totals (`src/services/pricing.js`) are built from the menu rows inside one transaction, and the schema
  is strict, so `unitPrice`/`total` in the payload is a 422. Duplicate dish ids are merged into one line.
- A dish that is switched off or no longer on the menu is refused **per line** (`details[].message`), which
  is what the cart UI needs to show.
- The reference is generated (`ORD-1001`, `ORD-1002`, …) from the row id inside the same transaction, so it
  is short, readable and collision-free.
- Status flow `pending → preparing → ready → delivered` (+ `cancelled`) lives in the service
  (`ORDER_STATUS_FLOW`). A refused jump returns 409 **with the list of allowed next states**. Ownership is
  checked before the state rule, so a stranger gets 403 rather than leaking the order's state.
- Guest orders have `user_id = NULL` plus contact details; they can be read back with the reference and
  the email they were placed with. Orders that belong to an account are never released by an email match.
- Feedback keeps `sentiment` NULL: the AI feedback analysis feature fills it in.

## Reservations and events

```
GET    /api/reservations/availability      public: ?date=&startTime=&endTime=&partySize=&area=
POST   /api/reservations                   customer or guest (a guest must give name + email)
GET    /api/reservations                   ?date=&from=&to=&status=&type=&tableId=&search=&limit=&offset=
GET    /api/reservations/:reservationId    owner or admin
PATCH  /api/reservations/:reservationId    owner while pending, admin any time
PATCH  /api/reservations/:reservationId/status   admin approves/completes/cancels; owner may cancel
DELETE /api/reservations/:reservationId    admin only
POST   /api/events                         request a birthday / corporate / group booking
GET    /api/events                         admin: every event request; customer: their own
PATCH  /api/events/:eventId                admin (or the customer while it is still pending)
```

- **No double booking.** The slot is checked inside a transaction with
  `SELECT … WHERE reservation_date = ? AND table_id = ? AND status <> 'cancelled' AND start_time < ? AND
  end_time > ? FOR UPDATE`, then the booking is inserted before the commit. A unique index cannot express
  a time range, and a cancelled booking must not keep a table blocked, so the range test plus the row lock
  is the mechanism. A test fires **two bookings for the same slot at the same time** and asserts exactly one
  201 and one 409.
- The **availability query** uses the same overlap condition, so the tables the booking form offers are the
  tables the booking will actually accept.
- The slot must be inside the published opening hours (`config/env.js`), the date must be in the future,
  the table must have room for the party, and the party must fit `MAX_PARTY_SIZE`. If the customer does not
  choose a table, the smallest free table that fits is assigned.
- Events are reservations with a type, so the availability rules are written once; the event routes add the
  fields that matter for an event (occasion, requirements, `menu_selection` expanded into real dishes).

## Conventions

- **JSON in / JSON out.** Every route lives under `/api`, success responses are plain resources.
- **One error shape.** Failures are always
  `{ "error": { "message": "...", "details": [{ "field": "...", "message": "..." }] } }`, produced by
  `errorHandler` from an `ApiError`, a zod validation error, malformed JSON (400), an oversized body
  (413) or a duplicate key (409). Unexpected errors are 500 and are logged with a stack trace, never
  leaked to the client.
- **Layered routes.** `routes → controller → service → data access`, so business rules can be unit
  tested without HTTP or a database.
- **Validation before persistence.** Every write body is parsed by a zod schema; `PATCH /:id` uses
  `strictObject().partial()` so only supplied fields change.
- **Authorization is middleware.** `requireAuth` resolves the session user, `requireRole('admin')`
  gates admin routes, and customer-owned resources are filtered by the session user id.

## Configuration (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT`, `NODE_ENV` | HTTP port and environment |
| `CORS_ORIGIN` | allowed frontend origin(s), comma separated |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | token signing for login sessions |
| `MYSQL_URI`, `MYSQL_TEST_URI` | development and test schemas (tests never touch dev data) |
| `DB_POOL_SIZE`, `DB_CONNECT_TIMEOUT_MS` | pool size and connection timeout |
| `RESTAURANT_NAME`, `MAX_PARTY_SIZE` | restaurant details used by validation and the AI assistant |
