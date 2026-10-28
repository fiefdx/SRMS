import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppContext } from './appStore';
import usePersistentState from '../hooks/usePersistentState';
import { MENU_ITEMS, TABLES } from '../data/menuData';
import { SEED_ORDERS, SEED_RESERVATIONS, SEED_FEEDBACK } from '../data/seedData';
import { calcTotals, makeId, nextNumber } from '../utils/helpers';

/**
 * Single application store for Assignment 1.
 *
 * Every piece of state is created with usePersistentState (useState + localStorage) and every
 * mutation is exposed as a named function. Components never touch the arrays directly, which keeps
 * the logic in one place and makes the swap to REST calls in Assignment 2 a one-file change.
 */

const ADMIN_EMAILS = ['admin@srms.dev'];

/** Identifies a signed-out visitor so "My orders" only lists what this browser actually placed. */
function newGuestSessionId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `guest-${Date.now().toString(36)}-${random}`;
}

export function AppProvider({ children }) {
  const [menuItems, setMenuItems] = usePersistentState('menuItems', MENU_ITEMS);
  const [cart, setCart] = usePersistentState('cart', []);
  const [orders, setOrders] = usePersistentState('orders', SEED_ORDERS);
  const [reservations, setReservations] = usePersistentState('reservations', SEED_RESERVATIONS);
  const [feedback, setFeedback] = usePersistentState('feedback', SEED_FEEDBACK);
  const [user, setUser] = usePersistentState('user', null);
  const [preferences, setPreferences] = usePersistentState('preferences', {
    favouriteIds: [],
    dietary: [],
  });
  // Toast notifications are intentionally ephemeral, so they use plain useState.
  const [notifications, setNotifications] = useState([]);

  // Guest identity for signed-out ordering. Persisted so a refresh keeps the same visitor id.
  const [storedGuestSession, setGuestSession] = usePersistentState('guestSession', null);
  const guestSessionId = useMemo(
    () => storedGuestSession ?? newGuestSessionId(),
    [storedGuestSession],
  );
  useEffect(() => {
    if (storedGuestSession === null) setGuestSession(guestSessionId);
  }, [storedGuestSession, guestSessionId, setGuestSession]);

  /* ----------------------------------------------------------------- helpers */

  const notify = useCallback((message, tone = 'success') => {
    const id = `note-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    setNotifications((prev) => [...prev, { id, message, tone }]);
  }, []);

  const dismissNotification = useCallback(
    (id) => setNotifications((prev) => prev.filter((note) => note.id !== id)),
    [],
  );

  /* ------------------------------------------------------------------- cart */

  const addToCart = useCallback(
    (item, quantity = 1) => {
      setCart((prev) => {
        const existing = prev.find((line) => line.id === item.id);
        if (existing) {
          return prev.map((line) =>
            line.id === item.id ? { ...line, quantity: line.quantity + quantity } : line,
          );
        }
        return [...prev, { id: item.id, name: item.name, price: item.price, quantity }];
      });
    },
    [setCart],
  );

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  }, [setCart]);

  const updateQuantity = useCallback(
    (id, quantity) => {
      const safe = Math.max(0, Math.min(99, Number(quantity) || 0));
      setCart((prev) =>
        safe === 0
          ? prev.filter((line) => line.id !== id)
          : prev.map((line) => (line.id === id ? { ...line, quantity: safe } : line)),
      );
    },
    [setCart],
  );

  const clearCart = useCallback(() => setCart([]), [setCart]);

  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);
  const cartTotals = useMemo(() => calcTotals(cart, 'delivery'), [cart]);

  /* ----------------------------------------------------------------- orders */

  const placeOrder = useCallback(
    (checkoutForm) => {
      const totals = calcTotals(cart, checkoutForm.type);
      const order = {
        id: makeId('ORD', nextNumber(orders, 'ORD')),
        customerName: checkoutForm.name,
        email: checkoutForm.email,
        phone: checkoutForm.phone,
        type: checkoutForm.type,
        address: checkoutForm.type === 'delivery' ? checkoutForm.address : '',
        pickupTime: checkoutForm.type === 'pickup' ? checkoutForm.pickupTime : '',
        notes: checkoutForm.notes,
        items: cart,
        ...totals,
        status: 'pending',
        createdAt: new Date().toISOString(),
        placedBy: user?.id ?? guestSessionId,
      };
      setOrders((prev) => [order, ...prev]);
      setCart([]);
      return order;
    },
    [cart, orders, setOrders, setCart, user, guestSessionId],
  );

  const updateOrderStatus = useCallback(
    (id, status) => {
      setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, status } : order)));
    },
    [setOrders],
  );

  const cancelOrder = useCallback(
    (id) => {
      setOrders((prev) =>
        prev.map((order) => (order.id === id ? { ...order, status: 'cancelled' } : order)),
      );
    },
    [setOrders],
  );

  /* ---------------------------------------------------------- reservations */

  /**
   * Client-side double-booking guard (the same rule will be enforced server-side in Assignment 2).
   * A table is free when its seats fit the party and it is not already booked for that date+time.
   */
  const findAvailableTable = useCallback(
    (date, time, guests) => {
      const bookedTableIds = new Set(
        reservations
          .filter((r) => r.date === date && r.time === time && r.status !== 'cancelled')
          .map((r) => r.tableId),
      );
      return (
        TABLES.find((table) => table.seats >= guests && !bookedTableIds.has(table.id)) ?? null
      );
    },
    [reservations],
  );

  const createReservation = useCallback(
    (form) => {
      const table = findAvailableTable(form.date, form.time, form.guests);
      if (!table) {
        return { ok: false, error: 'No table is free for that date and time. Please pick another slot.' };
      }
      const reservation = {
        id: makeId('RES', nextNumber(reservations, 'RES') + 1),
        customerName: form.name,
        email: form.email,
        phone: form.phone,
        date: form.date,
        time: form.time,
        guests: form.guests,
        type: form.type,
        requirements: form.requirements,
        tableId: table.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        placedBy: user?.id ?? guestSessionId,
      };
      setReservations((prev) => [reservation, ...prev]);
      return { ok: true, reservation };
    },
    [findAvailableTable, reservations, setReservations, user, guestSessionId],
  );

  const updateReservationStatus = useCallback(
    (id, status) => {
      setReservations((prev) =>
        prev.map((reservation) => (reservation.id === id ? { ...reservation, status } : reservation)),
      );
    },
    [setReservations],
  );

  const deleteReservation = useCallback(
    (id) => setReservations((prev) => prev.filter((r) => r.id !== id)),
    [setReservations],
  );

  /* ------------------------------------------------------------ menu (admin) */

  const saveMenuItem = useCallback(
    (draft) => {
      const isNew = !draft.id;
      const item = {
        id: isNew ? makeId('m', Date.now() % 100000) : draft.id,
        name: draft.name.trim(),
        category: draft.category,
        description: draft.description.trim(),
        ingredients: draft.ingredients
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
        dietary: draft.dietary,
        price: Number(Number(draft.price).toFixed(2)),
        available: draft.available,
        popular: draft.popular,
        spicy: draft.dietary.includes('spicy'),
        todaySpecial: draft.todaySpecial,
        emoji: draft.emoji || '🍽️',
      };
      setMenuItems((prev) => (isNew ? [item, ...prev] : prev.map((i) => (i.id === item.id ? item : i))));
      return item;
    },
    [setMenuItems],
  );

  const deleteMenuItem = useCallback(
    (id) => setMenuItems((prev) => prev.filter((item) => item.id !== id)),
    [setMenuItems],
  );

  const toggleAvailability = useCallback(
    (id) =>
      setMenuItems((prev) => prev.map((item) => (item.id === id ? { ...item, available: !item.available } : item))),
    [setMenuItems],
  );

  const resetMenu = useCallback(() => setMenuItems(MENU_ITEMS), [setMenuItems]);

  /** Handy when recording a demo: puts every collection back to its seeded state. */
  const resetDemoData = useCallback(() => {
    setMenuItems(MENU_ITEMS);
    setOrders(SEED_ORDERS);
    setReservations(SEED_RESERVATIONS);
    setFeedback(SEED_FEEDBACK);
    setCart([]);
  }, [setMenuItems, setOrders, setReservations, setFeedback, setCart]);

  /* ----------------------------------------------------------- account (demo) */

  const signIn = useCallback(
    (form, asAdmin) => {
      const isAdmin = asAdmin || ADMIN_EMAILS.includes(form.email.toLowerCase());
      const account = {
        id: `u-${form.email.toLowerCase()}`,
        name: form.name || form.email.split('@')[0],
        email: form.email,
        role: isAdmin ? 'admin' : 'customer',
      };
      setUser(account);
      return account;
    },
    [setUser],
  );

  const signOut = useCallback(() => setUser(null), [setUser]);

  const toggleFavourite = useCallback(
    (itemId) => {
      setPreferences((prev) => ({
        ...prev,
        favouriteIds: prev.favouriteIds.includes(itemId)
          ? prev.favouriteIds.filter((id) => id !== itemId)
          : [...prev.favouriteIds, itemId],
      }));
    },
    [setPreferences],
  );

  const setDietaryPreferences = useCallback(
    (dietary) => setPreferences((prev) => ({ ...prev, dietary })),
    [setPreferences],
  );

  /* --------------------------------------------------------------- feedback */

  const addFeedback = useCallback(
    (entry) => {
      setFeedback((prev) => [
        { ...entry, id: `fb-${Date.now()}`, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    },
    [setFeedback],
  );

  /* ------------------------------------------------- customer-scoped selectors */

  /**
   * Signed-in customers see records linked to their account; signed-out visitors see only the records
   * created by this browser session, so "My orders" never shows somebody else's history. The admin
   * pages keep using the full collections.
   */
  const myOrders = useMemo(
    () =>
      user
        ? orders.filter((o) => o.placedBy === user.id || o.email === user.email)
        : orders.filter((o) => o.placedBy === guestSessionId),
    [orders, user, guestSessionId],
  );

  const myReservations = useMemo(
    () =>
      user
        ? reservations.filter((r) => r.placedBy === user.id || r.email === user.email)
        : reservations.filter((r) => r.placedBy === guestSessionId),
    [reservations, user, guestSessionId],
  );

  const value = useMemo(
    () => ({
      menuItems,
      cart,
      cartCount,
      cartTotals,
      orders,
      reservations,
      myOrders,
      myReservations,
      guestSessionId,
      feedback,
      user,
      preferences,
      notifications,
      tables: TABLES,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      placeOrder,
      updateOrderStatus,
      cancelOrder,
      findAvailableTable,
      createReservation,
      updateReservationStatus,
      deleteReservation,
      saveMenuItem,
      deleteMenuItem,
      toggleAvailability,
      resetMenu,
      resetDemoData,
      signIn,
      signOut,
      toggleFavourite,
      setDietaryPreferences,
      addFeedback,
      notify,
      dismissNotification,
    }),
    [
      menuItems, cart, cartCount, cartTotals, orders, reservations, myOrders, myReservations,
      guestSessionId, feedback, user, preferences,
      notifications, addToCart, removeFromCart, updateQuantity, clearCart, placeOrder,
      updateOrderStatus, cancelOrder, findAvailableTable, createReservation, updateReservationStatus,
      deleteReservation, saveMenuItem, deleteMenuItem, toggleAvailability, resetMenu, resetDemoData, signIn,
      signOut, toggleFavourite, setDietaryPreferences, addFeedback, notify, dismissNotification,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
