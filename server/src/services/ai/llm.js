/**
 * Optional external AI provider.
 *
 * If OPENAI_API_KEY (or AI_BASE_URL) is set in server/.env, the feedback brief can be written by a real
 * language model. If it is not set, or the call fails, the caller falls back to the local brief — the
 * endpoint never depends on the network being up.
 */
import config from '../../config/env.js';

export function llmConfigured() {
  return Boolean(config.ai.apiKey);
}

export async function summariseFeedbackWithLlm(brief, reviews) {
  if (!llmConfigured()) throw new Error('No AI provider configured (set OPENAI_API_KEY in server/.env)');

  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.ai.apiKey}` },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You write short, plain-English briefings for a restaurant manager from customer feedback statistics. Two or three sentences, no invented facts.',
        },
        { role: 'user', content: `Feedback statistics: ${JSON.stringify({ brief, reviews })}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`AI provider responded with ${response.status}`);

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI provider returned no text');

  return { text, generatedBy: config.ai.model };
}
