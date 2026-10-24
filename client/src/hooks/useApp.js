import { useContext } from 'react';
import { AppContext } from '../context/appStore';

/** Convenience hook: throws a clear error when a component is used outside the provider. */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside <AppProvider>.');
  }
  return context;
}
