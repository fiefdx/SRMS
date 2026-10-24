/**
 * Small shared helpers. Kept framework free so they can be unit tested later.
 */

export const TAX_RATE = 0.09;
export const DELIVERY_FEE = 3.5;
export const FREE_DELIVERY_FROM = 40;

export function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

/** Simple readable id, e.g. makeId('ORD', 1045) -> 'ORD-1045' */
export function makeId(prefix, number) {
  return `${prefix}-${number}`;
}

export function nextNumber(records, prefix) {
  const highest = records.reduce((max, record) => {
    const n = Number(String(record.id).replace(`${prefix}-`, ''));
    return Number.isFinite(n) && n > max ? n : max;
  }, 1000);
  return highest + 1;
}

export function cartLineTotal(item) {
  return item.price * item.quantity;
}

/** Order totals are derived in one place so cart, checkout and admin all agree. */
export function calcTotals(items, type = 'delivery') {
  const subtotal = items.reduce((sum, item) => sum + cartLineTotal(item), 0);
  const deliveryFee =
    type === 'delivery' && subtotal > 0 && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
  const tax = subtotal * TAX_RATE;
  return {
    subtotal,
    deliveryFee,
    tax,
    total: subtotal + deliveryFee + tax,
  };
}

export function formatDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return `${formatDate(dateValue)} · ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

export function isValidPhone(value) {
  return /^[0-9+\s()-]{7,20}$/.test(String(value || '').trim());
}

export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
