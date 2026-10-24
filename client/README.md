# SRMS client (React + Vite)

Frontend for the Smart Restaurant Management System — Assignment 1 of the SODV2201 project.

## Scripts

```bash
npm install     # install dependencies
npm run dev     # start the dev server on http://localhost:5173
npm run lint    # oxlint checks
npm run build   # production build to dist/
npm run preview # serve the production build locally
```

## Source layout

```
src/
  main.jsx            app entry: router + AppProvider + shell (Navbar/Footer/Toasts)
  App.jsx             route table
  index.css           design tokens and component styles
  context/            AppContext — single store for menu, cart, orders, reservations, feedback, user
  hooks/              usePersistentState (useState + localStorage), useMenuFilters
  data/               menuData.js (menu, tables, hours), seedData.js, aiKnowledgeBase.js
  services/           simulated AI assistant engine
  components/         reusable prop-driven components (Navbar, MenuCard, CartList, forms, toasts…)
  pages/              customer pages and admin/ dashboard pages
  utils/              money/total/date/validation helpers
```

State lives in `localStorage` during Assignment 1 and is replaced by REST calls to the Node/Express
backend in Assignment 2.
