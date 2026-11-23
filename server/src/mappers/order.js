/**
 * Row -> JSON shape for orders. Money is converted to numbers, the JSON columns are parsed, and the
 * line items keep the name and price that were sold (they are a snapshot, not a join to the menu).
 */
export function toOrder(row, items = []) {
  if (!row) return null;

  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id ?? null,
    contact: row.contact_name || row.contact_email || row.contact_phone
      ? { name: row.contact_name ?? null, email: row.contact_email ?? null, phone: row.contact_phone ?? null }
      : null,
    status: row.status,
    fulfilment: row.fulfilment,
    fulfilmentDetails: parseJson(row.fulfilment_details),
    notes: row.notes ?? null,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    tax: Number(row.tax),
    total: Number(row.total),
    items: items.map(toOrderItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toOrderItem(row) {
  return {
    id: row.id,
    menuItemId: row.menu_item_id ?? null,
    name: row.name,
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    lineTotal: Number(row.line_total),
  };
}

function parseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
