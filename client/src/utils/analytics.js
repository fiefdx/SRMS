/**
 * Analytics helpers for the admin dashboard.
 *
 * Kept outside the components so the dashboard stays readable and the same aggregation can be
 * reused by the AI assistant (popular items) and, later, by backend reports.
 */

const POSITIVE_WORDS = ['excellent', 'great', 'tasty', 'perfect', 'hot', 'love', 'good', 'amazing', 'fresh'];
const NEGATIVE_WORDS = ['slow', 'late', 'cold', 'bad', 'wait', 'longer', 'wrong', 'disappointing', 'expensive'];

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready', 'delivered'];

export function orderedFrequency(orders) {
  const counts = new Map();
  orders
    .filter((order) => order.status !== 'cancelled')
    .forEach((order) => {
      order.items.forEach((line) => {
        counts.set(line.name, (counts.get(line.name) ?? 0) + line.quantity);
      });
    });
  return [...counts.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

/** Orders per day for the last `days` days, oldest first (used for the bar chart). */
export function ordersByDay(orders, days = 7) {
  const buckets = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const key = day.toDateString();
    const dayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === key);
    buckets.push({
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      date: key,
      count: dayOrders.length,
      revenue: dayOrders.reduce((sum, order) => sum + (order.status === 'cancelled' ? 0 : order.total), 0),
    });
  }
  return buckets;
}

export function revenueSummary(orders) {
  const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const revenue = active.reduce((sum, order) => sum + order.total, 0);
  return {
    orders: active.length,
    revenue,
    average: active.length ? revenue / active.length : 0,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
    open: orders.filter((order) => ['pending', 'preparing', 'ready'].includes(order.status)).length,
  };
}

export function reservationSummary(reservations) {
  return {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === 'pending').length,
    approved: reservations.filter((r) => r.status === 'approved').length,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
    events: reservations.filter((r) => r.type !== 'standard').length,
    guests: reservations
      .filter((r) => r.status !== 'cancelled')
      .reduce((sum, r) => sum + r.guests, 0),
  };
}

/**
 * Simple local sentiment summary of customer feedback. This is the "AI powered sentiment analysis"
 * enhancement mentioned in the brief, implemented with a keyword rule instead of a model — it can be
 * swapped for a real classification call in the final project.
 */
export function feedbackSummary(feedback) {
  const average = feedback.length
    ? feedback.reduce((sum, entry) => sum + Number(entry.rating), 0) / feedback.length
    : 0;

  const sentiment = { positive: 0, negative: 0, neutral: 0 };
  const themes = { positive: new Map(), negative: new Map() };

  feedback.forEach((entry) => {
    const words = String(entry.comment).toLowerCase().split(/[^a-z']+/).filter(Boolean);
    const pos = words.filter((word) => POSITIVE_WORDS.includes(word));
    const neg = words.filter((word) => NEGATIVE_WORDS.includes(word));

    if (pos.length > neg.length) sentiment.positive += 1;
    else if (neg.length > pos.length) sentiment.negative += 1;
    else sentiment.neutral += 1;

    pos.forEach((word) => themes.positive.set(word, (themes.positive.get(word) ?? 0) + 1));
    neg.forEach((word) => themes.negative.set(word, (themes.negative.get(word) ?? 0) + 1));
  });

  const topTheme = (map) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word, count]) => `${word} (${count})`);

  return {
    count: feedback.length,
    average,
    sentiment,
    positives: topTheme(themes.positive),
    negatives: topTheme(themes.negative),
  };
}
