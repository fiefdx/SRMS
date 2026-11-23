/**
 * AI endpoints.
 *
 *   POST /api/ai/ask                       public; a signed-in customer also gets personal answers
 *   POST /api/admin/feedback/analyze       admin; labels feedback sentiment
 *   GET  /api/admin/feedback/summary       admin; short written brief (local rules, or a model if configured)
 */
import { answerQuestion } from '../services/ai/assistant.js';
import { analyseFeedback, feedbackBrief } from '../services/ai/feedbackAnalysis.js';
import { llmConfigured, summariseFeedbackWithLlm } from '../services/ai/llm.js';

export async function ask(req, res) {
  const answer = await answerQuestion(req.valid.body.question, req.user ?? null);
  res.json({
    question: req.valid.body.question,
    ...answer,
    suggestedQuestions: answer.options ?? [],
    answeredAt: new Date().toISOString(),
  });
}

export async function analyseFeedbackHandler(req, res) {
  res.json(await analyseFeedback(req.valid.body));
}

export async function feedbackSummary(req, res) {
  const brief = await feedbackBrief();

  if (req.valid.query.provider === 'ai' && llmConfigured()) {
    try {
      const written = await summariseFeedbackWithLlm(brief, { reviews: brief.reviews, averageRating: brief.averageRating });
      return res.json({ ...brief, text: written.text, generatedBy: written.generatedBy });
    } catch (error) {
      return res.json({ ...brief, note: `AI provider unavailable, using the local brief: ${error.message}` });
    }
  }

  const note =
    req.valid.query.provider === 'ai' ? 'No AI provider configured (set OPENAI_API_KEY), using the local brief.' : undefined;
  return res.json({ ...brief, ...(note ? { note } : {}) });
}
