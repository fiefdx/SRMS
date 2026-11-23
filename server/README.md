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
| `orders` | one order per customer | unique reference, status enum, fulfilment details JSON, stored subtotal/fee/tax/total, index on `(user_id, status)` for "my orders" |
| `order_items` | order lines | keeps the **name and unit price at purchase time**, `line_total` is a generated column (`unit_price * quantity`), cascade delete with the order |
| `reservations` | tables **and** event bookings | `type ENUM('standard','birthday','corporate','group')`, date/time/party size with checks, occasion + requirements + `menu_selection` for events, index on `(reservation_date, start_time)` for the availability query |
| `feedback` | customer comments | rating 1–5 checked, link to the order, `sentiment` filled by the AI feedback analysis feature |

Double booking is prevented in a transaction (`SELECT … FOR UPDATE`) rather than by a unique index,
because a cancelled booking must not keep the table blocked for that slot.

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
