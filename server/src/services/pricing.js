/**
 * Pricing rules shared by the seed script and the order endpoints, so a quote the customer sees and
 * the amount stored in the database can never disagree.
 *
 * A "line" is { unitPrice, quantity } — the price captured at the moment of ordering.
 */
export const TAX_RATE = 0.09;
export const DELIVERY_FEE = 3.5;
export const FREE_DELIVERY_FROM = 40;

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function lineTotal(unitPrice, quantity) {
  return round2(Number(unitPrice) * Number(quantity));
}

/**
 * @param {Array<{unitPrice:number,quantity:number}>} lines
 * @param {'delivery'|'pickup'} fulfilment
 */
export function calculateTotals(lines = [], fulfilment = 'delivery') {
  const subtotal = round2(
    lines.reduce((sum, line) => sum + lineTotal(line.unitPrice, line.quantity), 0),
  );
  const deliveryFee =
    fulfilment === 'delivery' && subtotal > 0 && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
  const tax = round2(subtotal * TAX_RATE);

  return { subtotal, deliveryFee, tax, total: round2(subtotal + deliveryFee + tax) };
}
