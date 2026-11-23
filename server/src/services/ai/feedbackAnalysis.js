/**
 * Turning customer feedback into something the restaurant can act on: label each comment as
 * positive / neutral / negative, and produce a short written summary. The classification is the local
 * explainable classifier in services/ai/sentiment.js; services/ai/llm.js can send the same rows to an
 * external model when one is configured.
 */
import { execute, query } from '../../db/pool.js';
import { classifySentiment } from './sentiment.js';

/** Label the rows that have no sentiment yet (or every row when force is set). */
export async function analyseFeedback({ limit = 100, force = false } = {}, uri) {
  const filter = force ? '' : 'WHERE sentiment IS NULL';
  const rows = await query(`SELECT id, comment, rating FROM feedback ${filter} ORDER BY id LIMIT ?`, [limit], uri);

  const results = [];
  for (const row of rows) {
    const verdict = classifySentiment(row.comment, row.rating === null ? null : Number(row.rating));
    await execute('UPDATE feedback SET sentiment = ? WHERE id = ?', [verdict.sentiment, row.id], uri);
    results.push({
      id: row.id,
      rating: row.rating === null ? null : Number(row.rating),
      sentiment: verdict.sentiment,
      reason: verdict.reason,
      matched: { positive: verdict.positive, negative: verdict.negative },
      score: verdict.score,
    });
  }

  const breakdown = await query(
    'SELECT COALESCE(sentiment, "not analysed") AS sentiment, COUNT(*) AS reviews FROM feedback GROUP BY sentiment ORDER BY reviews DESC',
    [],
    uri,
  );

  return {
    analysed: results.length,
    results,
    breakdown: breakdown.map((row) => ({ sentiment: row.sentiment, reviews: Number(row.reviews) })),
  };
}

/** A short brief for the dashboard: how customers feel, and the words behind that. */
export async function feedbackBrief(uri) {
  const [totals] = await query('SELECT COUNT(*) AS reviews, AVG(rating) AS average_rating FROM feedback', [], uri);
  const rows = await query('SELECT id, comment, rating, sentiment FROM feedback ORDER BY id DESC LIMIT 50', [], uri);

  const praise = new Map();
  const complaints = new Map();

  for (const row of rows) {
    const verdict = classifySentiment(row.comment, row.rating === null ? null : Number(row.rating));
    for (const word of verdict.positive) praise.set(word, (praise.get(word) ?? 0) + 1);
    for (const word of verdict.negative) complaints.set(word, (complaints.get(word) ?? 0) + 1);
  }

  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word]) => word);
  const reviews = Number(totals.reviews);
  const average = Number(Number(totals.average_rating ?? 0).toFixed(2));

  const parts = [];
  if (reviews === 0) parts.push('No customer feedback has been collected yet.');
  else {
    parts.push(`${reviews} review${reviews === 1 ? '' : 's'} collected, average rating ${average}/5.`);
    if (praise.size) parts.push(`Customers praised: ${top(praise).join(', ')}.`);
    if (complaints.size) parts.push(`Recurring complaints: ${top(complaints).join(', ')}.`);
  }

  return {
    reviews,
    averageRating: average,
    praise: top(praise),
    complaints: top(complaints),
    text: parts.join(' '),
    generatedBy: 'local',
  };
}
