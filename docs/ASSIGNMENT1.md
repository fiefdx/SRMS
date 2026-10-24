# Assignment 1 — React frontend (customer + admin use cases)

Scope note: this phase is **frontend only**. State lives in a React context persisted to
`localStorage`. Assignment 2 replaces it with a Node.js/Express + database backend, and the final
project connects the two.

---

## 1. Customer interaction use case → where it lives

| Requirement from the brief | Implementation |
| --- | --- |
| Categorized menu (starters, mains, desserts, beverages) with descriptions, ingredients, pricing | `src/data/menuData.js`, `src/pages/Menu.jsx`, `src/components/MenuCard.jsx` |
| Filter / search by category, dietary restriction, price | `src/hooks/useMenuFilters.js` + `src/components/MenuFilters.jsx` (search, category tabs, dietary checkboxes, min/max price, sorting, available-only, favourites-only) |
| Order for delivery or pickup | `src/pages/Checkout.jsx` (order-type select drives conditional fields and delivery-fee calculation in `utils/helpers.js`) |
| Manage shopping cart | `src/pages/Cart.jsx`, `src/components/CartList.jsx`, cart actions in `context/AppContext.jsx` |
| Order confirmation | `src/pages/OrderConfirmation.jsx` (route `/order/:id`) |
| Order status updates | `StatusTimeline.jsx` + status flow `pending → preparing → ready → delivered` updated from the admin side and visible to the customer in `pages/Orders.jsx` |
| Book a table for a date/time | `src/pages/Reserve.jsx` (date, time slot, guests, contact) |
| Reserve special events (birthday, corporate) | booking-type select + conditional "Event requirements" field in `Reserve.jsx`; shown on `pages/Reservations.jsx` and managed in `pages/admin/AdminReservations.jsx` |
| Confirmation notification after a reservation | `notify()` toast system (`components/ToastStack.jsx`) + booking reference and confirmation text on `Reservations.jsx` |
| Prevent double booking / unavailable tables | `findAvailableTable()` in `AppContext.jsx` checks seats and existing bookings for that date+time; live availability preview in `Reserve.jsx` |
| Optional AI assistant (option 2: simulate locally) | `src/services/aiAssistant.js`, `src/data/aiKnowledgeBase.js`, `src/pages/AIChat.jsx`, `src/hooks/useChat.js` |
| Personalized recommendations from previous orders / popular items | `orderedFrequency()` in `utils/analytics.js` used by the assistant's `recommendations()` and `previousOrder()` |
| Answer common queries (specials, dietary info) | scripted pairs from the brief in `SIMULATED_QA` + rule intents (hours, delivery, allergens, prices, reservations) |
| Optional customer accounts: preferences, order history, reservations | `src/pages/Account.jsx` (simulated sign-in, dietary preferences, favourites, activity table), `pages/Orders.jsx`, `pages/Reservations.jsx` |

## 2. Admin use case → where it lives

| Requirement | Implementation |
| --- | --- |
| Dashboard with role protection | `src/components/AdminLayout.jsx` (role gate + nested `<Outlet />` routes) |
| CRUD menu items, availability in real time | `src/pages/admin/AdminMenu.jsx` (validated editor, availability toggle, delete with confirm, filters reused from the customer side) |
| Monitor incoming orders and update status | `src/pages/admin/AdminOrders.jsx` (status select, "Advance" button, status filters) |
| Manage reservations / events, approve or cancel | `src/pages/admin/AdminReservations.jsx` |
| Analytics: orders per day/week, popular items, feedback summary | `src/utils/analytics.js` + `src/pages/admin/AdminDashboard.jsx` (`BarChart`, `StatCard`, top dishes, feedback sentiment summary) |

Bonus (optional enhancement in the brief): a keyword sentiment summary of customer feedback is
implemented locally in `feedbackSummary()` and shown on the admin dashboard.

---

## 3. How the rubric points are covered

**React concepts (components, props, state, hooks)**
- One store (`AppContext`) exposing named mutations; components consume it through `useApp`.
- Prop-driven presentational components: `MenuCard`, `CartList`, `FormField`, `ChatBubble`,
  `StatusBadge`, `StatusTimeline`, `StatCard`, `BarChart` (no hidden context access).
- Custom hooks: `usePersistentState` (useState + localStorage), `useMenuFilters` (filter state +
  `useMemo` derived list), `useChat` (message state machine with timeout cleanup in `useEffect`).
- `useMemo` for derived data (cart totals, analytics, grouping), `useCallback` for stable handlers,
  `useRef` for the chat log scroll.

**Forms handling** — `Checkout`, `Reserve`, `Account`, `AdminMenu` all validate before submit, show
per-field error messages, and clear the error when the field is edited again. `FormField` keeps the
markup consistent.

**Conditional rendering** — empty states, availability-disabled cards, delivery vs pickup fields,
event vs standard booking fields, admin role gate, favourites toggle, pending/typing chat state.

**List rendering** — menu grouped by category, cart lines, order tables, admin tables, chat log,
table plan, filter chips. Every list uses a stable `key`.

**Routing** — `/`, `/menu`, `/cart`, `/checkout`, `/order/:id`, `/orders`, `/reserve`,
`/reservations`, `/chat`, `/account`, `/admin`, `/admin/menu`, `/admin/orders`,
`/admin/reservations`, plus a `*` 404 page and nested admin routes with `Outlet`.

**Error handling & verification**
- Form validation with user-facing messages and toast notifications (`tone: 'error'`).
- Reservation conflict handling (no table free → banner + toast, no data written).
- `usePersistentState` catches corrupt/unavailable localStorage instead of crashing.
- `useApp()` throws a clear error if a component is used outside the provider.
- Missing order/reservation on a direct URL renders a "not found" panel instead of breaking.
- `npm run lint` (oxlint) is clean and `npm run check:ai` verifies the six required AI
  question/response pairs against the live menu/seed data.

**Code quality** — small files with a single responsibility, data in `data/`, logic in `context/`,
`hooks/`, `services/`, `utils/`, presentation in `components/` and `pages/`, comments explaining
*why* (e.g. why the scripted AI answers get precedence, why the analytics helpers are shared).

---

## 4. Run and verify

```bash
cd client
npm install
npm run dev        # http://localhost:5173
npm run lint       # oxlint
npm run check:ai   # verifies the AI answers required by the brief
npm run build      # production build
npm run preview    # serve the built app
```

Admin access: sign in at `/account` and tick **Sign in as administrator** (or use
`admin@srms.dev`).

Demo tips: `/admin` → **Restore demo data** resets menu, orders, bookings and feedback so the
walkthrough can be repeated. To wipe everything including the account, clear the site's localStorage.

## 5. Suggested walkthrough (for the recorded demo)

1. **Setup** — show `npm create vite@latest client -- --template react`, the folder layout and why
   `requirements/` is in `.gitignore`. Show `git log --oneline --graph` and the two feature branches.
2. **Data layer** — `menuData.js` (item shape = future database document), `seedData.js`,
   `aiKnowledgeBase.js`.
3. **Store** — `AppContext.jsx`: every mutation in one place, `usePersistentState` explaining how the
   swap to REST calls in Assignment 2 keeps components untouched.
4. **Menu** — search, category tabs, dietary filters, price range, sorting; point out `useMenuFilters`
   and `useMemo`, the grouped list rendering and the unavailable-item conditional rendering.
5. **Cart & checkout** — quantity controls, derived totals in `helpers.js`, validated form, delivery vs
   pickup conditional fields, order confirmation and the status timeline.
6. **Reservations** — live availability preview, then deliberately try to book the same table twice in
   the same slot to show the double-booking error; show an event booking with requirements.
7. **AI assistant** — run `npm run check:ai` in the terminal first (shows verification), then ask the
   six scripted questions plus “I want something spicy under $20” and “What is in Chicken Alfredo?”;
   explain scoring, the scripted-pair precedence and the rule intents reading live data.
8. **Admin** — sign in as admin (role gate), add/edit/delete a menu item and show it appear on the
   customer menu, advance an order status and show the change in the customer view, approve a booking,
   read the analytics (7-day chart, popular dishes, feedback sentiment).
9. **Clean-up / next phase** — `npm run lint`, `npm run build`, then what Assignment 2 adds (Express
   routes, database, JWT/sessions, server-side validation).

## 6. Deliberate limitations (resolved in Assignment 2 / final project)

- Accounts are simulated in the browser: no password storage, no token. Role checks are frontend
  only.
- Data is stored in `localStorage`; totals are computed on the client. Server-side validation and
  persistence are the next phase.
- Payment and delivery are simulated, as allowed by the project scope.
- The AI assistant is rule based (brief option 2). The engine is a pure function
  (`askAssistant(question, context)`) so it can be moved behind `POST /api/assistant` with a real
  Gemini/Groq/Ollama call without changing the chat UI.
