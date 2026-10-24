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

## Run

```bash
cd client
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

Admin demo access: sign in with email `admin@srms.dev` (or tick "Sign in as administrator").

## Tech

React 19 + Vite, React Router 7, plain CSS. State is kept in a React context and persisted to
`localStorage` for Assignment 1; it will be replaced by REST calls in Assignment 2.
