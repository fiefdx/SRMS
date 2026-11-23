import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, lineTotal, DELIVERY_FEE, FREE_DELIVERY_FROM, TAX_RATE } from '../src/services/pricing.js';

const lines = [
  { unitPrice: 14.99, quantity: 1 },
  { unitPrice: 5.99, quantity: 1 },
  { unitPrice: 4.5, quantity: 2 },
];

test('line totals round to cents', () => {
  assert.equal(lineTotal(14.99, 3), 44.97);
  assert.equal(lineTotal(0.1, 3), 0.3);
});

test('delivery orders under the free-delivery threshold pay the fee', () => {
  const totals = calculateTotals(lines, 'delivery');
  assert.equal(totals.subtotal, 29.98);
  assert.equal(totals.deliveryFee, DELIVERY_FEE);
  assert.equal(totals.tax, Number((29.98 * TAX_RATE).toFixed(2)));
  assert.equal(totals.total, 36.18);
});

test('delivery orders at or above the threshold are free', () => {
  const totals = calculateTotals([{ unitPrice: FREE_DELIVERY_FROM, quantity: 1 }], 'delivery');
  assert.equal(totals.deliveryFee, 0);
});

test('pickup never pays a delivery fee', () => {
  const totals = calculateTotals(lines, 'pickup');
  assert.equal(totals.deliveryFee, 0);
  assert.equal(totals.total, Number((29.98 * (1 + TAX_RATE)).toFixed(2)));
});

test('an empty cart totals zero', () => {
  assert.deepEqual(calculateTotals([], 'delivery'), { subtotal: 0, deliveryFee: 0, tax: 0, total: 0 });
});
