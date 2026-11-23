/**
 * Row -> JSON shape for menu items. Kept in one place so every endpoint (menu list, menu detail,
 * favourites, order lines, admin stats) returns the same field names and the same types:
 * DECIMAL becomes a number, TINYINT becomes a boolean, and the JSON columns stay arrays.
 */
export function toMenuItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    ingredients: toArray(row.ingredients),
    allergens: toArray(row.allergens),
    dietaryTags: toArray(row.dietary_tags),
    available: Boolean(Number(row.available)),
    todaySpecial: Boolean(Number(row.today_special)),
    popularity: Number(row.popularity ?? 0),
    emoji: row.emoji ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function toArray(value) {
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
