/**
 * Row -> JSON shape for reservations. The booked table is expanded into an object (the frontend shows the
 * label and seats) and menu_selection holds menu ids, which the service can expand into dishes.
 */
export function toReservation(row, menuItems = []) {
  if (!row) return null;

  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id ?? null,
    contact: row.contact_name || row.contact_email || row.contact_phone
      ? { name: row.contact_name ?? null, email: row.contact_email ?? null, phone: row.contact_phone ?? null }
      : null,
    type: row.type,
    table: row.table_id
      ? { id: row.table_id, label: row.table_label ?? null, seats: row.table_seats ?? null, area: row.table_area ?? null }
      : null,
    date: row.reservation_date,
    startTime: row.start_time,
    endTime: row.end_time,
    partySize: Number(row.party_size),
    occasion: row.occasion ?? null,
    requirements: row.requirements ?? null,
    menuSelection: menuItems,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function menuSelectionIds(row) {
  const value = row?.menu_selection;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
