import { createContext } from 'react';

/**
 * The context object lives on its own so AppContext.jsx exports a component only (fast-refresh
 * friendly) and hooks/useApp.js exports the hook.
 */
export const AppContext = createContext(null);
