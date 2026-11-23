/**
 * Sentiment analysis for customer feedback.
 *
 * This is a local, explainable classifier: a lexicon of food-service wording, plus the star rating the
 * customer gave, which is the strongest signal. It records *why* it decided (matched words and score) so
 * the restaurant can see the reasoning instead of trusting a black box.
 *
 * If an AI provider is configured (OPENAI_API_KEY in server/.env) the same rows can be classified by the
 * external model instead — see services/ai/llm.js; the local classifier is the fallback whenever the
 * network call fails or nothing is configured, so the endpoint always works offline.
 */
const POSITIVE = [
  'excellent', 'amazing', 'great', 'loved', 'love', 'delicious', 'fresh', 'friendly', 'perfect', 'wonderful',
  'best', 'fantastic', 'good', 'nice', 'well done', 'cooked well', 'great value', 'quick', 'recommend',
  'happy', 'impressed', 'early', 'warm',
];

const NEGATIVE = [
  'cold', 'bad', 'awful', 'slow', 'disappointing', 'disappointed', 'dirty', 'rude', 'overpriced', 'soggy',
  'undercooked', 'burnt', 'waited', 'worst', 'never', 'poor', 'unfriendly', 'late', 'hard', 'stale',
  'too small', 'could be bigger', 'not fresh',
];

function countMatches(text, words) {
  const matches = [];
  for (const word of words) {
    const pattern = new RegExp(`(^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|[.,!?;]|$)`, 'i');
    if (pattern.test(text)) matches.push(word);
  }
  return matches;
}

/**
 * @param text   the comment
 * @param rating 1-5 or null
 * @returns {{sentiment: 'positive'|'neutral'|'negative', score: number, positive: string[], negative: string[], reason: string}}
 */
export function classifySentiment(text, rating = null) {
  const body = String(text ?? '');
  const positive = countMatches(body, POSITIVE);
  const negative = countMatches(body, NEGATIVE);
  const score = positive.length - negative.length;

  let sentiment;
  let reason;

  if (rating !== null && rating >= 4 && score >= -1) {
    sentiment = 'positive';
    reason = `rating ${rating}/5${positive.length ? ` and ${positive.length} positive word(s)` : ''}`;
  } else if (rating !== null && rating <= 2) {
    sentiment = 'negative';
    reason = `rating ${rating}/5${negative.length ? ` and ${negative.length} negative word(s)` : ''}`;
  } else if (score > 0) {
    sentiment = 'positive';
    reason = `${positive.length} more positive than negative words`;
  } else if (score < 0) {
    sentiment = 'negative';
    reason = `${negative.length} more negative than positive words`;
  } else {
    sentiment = 'neutral';
    reason = 'no clear wording either way';
  }

  return { sentiment, score, positive, negative, reason };
}
