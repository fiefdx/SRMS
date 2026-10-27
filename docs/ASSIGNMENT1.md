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
| CRUD menu items, availability in real time | `src/pages/admin/AdminMenu.jsx` (validated editor, curated food-emoji icon picker in `components/EmojiPicker.jsx` fed by `MENU_EMOJIS`, availability toggle, delete with confirm, filters reused from the customer side) |
| Monitor incoming orders and update status | `src/pages/admin/AdminOrders.jsx` (status select, "Advance" button, status filters) |
| Manage reservations / events, approve or cancel | `src/pages/admin/AdminReservations.jsx` |
| Analytics: orders per day/week, popular items, feedback summary | `src/utils/analytics.js` + `src/pages/admin/AdminDashboard.jsx` (`BarChart`, `StatCard`, top dishes, feedback sentiment summary) |

Bonus (optional enhancement in the brief): a keyword sentiment summary of customer feedback is
implemented locally in `feedbackSummary()` and shown on the admin dashboard.

---

## 3. Run and verify

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
