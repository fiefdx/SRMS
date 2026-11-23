# SRMS backend (Assignment 2)

Node.js + Express REST API for the Smart Restaurant Management System: user accounts, menu,
orders, table reservations, event bookings, admin dashboard data and the AI menu assistant.

## Run

```bash
cd server
npm install
cp .env.example .env      # set JWT_SECRET and the database URI
npm run dev               # http://localhost:4000 (node --watch)
npm test                  # node:test + supertest
npm run lint              # oxlint
```

`GET http://localhost:4000/api` returns the endpoint list and `GET /api/health` the service status.

## Layout

```
server/
  src/
    app.js               Express app factory: CORS, JSON body limit, logging, routes, error handling
    index.js             starts the HTTP server, graceful shutdown on SIGINT/SIGTERM
    config/env.js        all environment configuration in one place (.env aware)
    middleware/          requestLogger, validate (zod), notFound, errorHandler, auth (added later)
    routes/              one router per resource, mounted under /api
    controllers/         request handling only: build the response, delegate logic to services
    services/            business rules (reservation availability, totals, status flow, AI assistant)
    models/ or db/       data layer (documents / tables, queries, migrations, seed script)
    validation/          zod schemas per resource
    utils/               ApiError, asyncHandler, money/date helpers
  scripts/seed.js        loads demo menu/users/orders/reservations into the database
  tests/                 node:test + supertest suites (API behaviour, validation, authorization)
```

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
| `DB_CLIENT`, `MONGODB_URI`, `MYSQL_URI` | data store selection and connection string |
| `RESTAURANT_NAME`, `MAX_PARTY_SIZE` | restaurant details used by validation and the AI assistant |
