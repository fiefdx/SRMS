# SRMS — Smart Restaurant Management System

Course: SODV2201 Final Project

**Current phase: Assignment 1 — React frontend** (`client/`).
Assignment 2 (Node.js/Express backend + database) and the fullstack integration will be added in
later phases of this same repository.

## Assignment 1 — what is implemented

Customer side
- Categorized menu browsing (starters, mains, desserts, beverages) with descriptions, ingredients,
  allergen/dietary tags and price.
- Search + filters (category, dietary restrictions, price range) and sorting.
- Shopping cart (add / remove / change quantity) with subtotal, delivery fee and tax.
- Checkout form (delivery or pickup) with client-side validation and an order confirmation page.
- Order history with live status updates (`pending → preparing → ready → delivered`).
- Table reservations and special-event bookings (birthday party / corporate gathering) with
  double-booking prevention and confirmation notifications.
- AI Menu Assistant chat (`simulated locally`, as allowed by the brief) that answers questions about
  specials, dietary options, popularity, ingredients, prices and the customer's previous order.
- Optional customer account: sign in to save preferences and view order history.

Admin side
- Admin dashboard gated by a role check (`customer` / `admin`).
- Menu CRUD with real-time availability toggling.
- Order monitoring and status updates.
- Reservation/event management (approve, cancel).
- Analytics: orders per day (7-day bar chart), revenue, popular items, feedback summary.

## Run and verify

```bash
cd client
npm install
npm run dev       # http://localhost:5173
npm run lint      # oxlint (clean)
npm run check:ai  # verifies the AI question/response pairs required by the brief
npm run build     # production build to client/dist
npm run preview   # serve the production build
```

Admin demo access: open `/account` and tick **Sign in as administrator** (or sign in with
`admin@srms.dev`). The admin dashboard has a **Restore demo data** button to reset the app before a
recording.

Data is kept in `localStorage` during Assignment 1; clear the site storage to remove the demo
account as well.

## Repository layout

```
client/                 React + Vite frontend (Assignment 1)
  src/data              menu, tables, opening hours, seed records, AI knowledge base
  src/context           single app store (cart, orders, reservations, feedback, user, toasts)
  src/hooks             usePersistentState, useMenuFilters, useChat
  src/services          simulated AI assistant engine
  src/utils             money/total/date/validation helpers + admin analytics
  src/components        reusable prop-driven components
  src/pages             customer pages + admin/ dashboard pages
  scripts/              checkAssistant.mjs (npm run check:ai)
docs/ASSIGNMENT1.md     brief-to-code map for the customer and admin use cases, run/verify steps
server/                 Node.js + Express backend (added in Assignment 2)
```

## Tech

React 19, Vite, React Router 7, plain CSS (design tokens in `client/src/index.css`). No UI library,
no backend calls yet: Assignment 2 adds Express + a database and the frontend switches from
`usePersistentState` to REST calls.

See [docs/ASSIGNMENT1.md](docs/ASSIGNMENT1.md) for the full mapping between the assignment brief and
the code.
