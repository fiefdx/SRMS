/**
 * Simulated AI Menu Assistant (Assignment 1, option 2: "Simulate the AI locally").
 *
 * How an answer is produced
 *  1. normalise the question (lowercase, strip punctuation)
 *  2. score the scripted question/response pairs from data/aiKnowledgeBase.js (SIMULATED_QA)
 *  3. score the rule based intents (INTENTS) whose answers are generated from the live menu and
 *     order data
 *  4. the scripted pairs get a small precedence boost because they are the answers required by the
 *     brief; the rules extend them with menu-aware answers
 *  5. if nothing matches, a fallback prompt is returned
 *
 * The function is pure: the component passes menuItems / orders / preferences in, so the engine is
 * easy to test and can later be moved behind POST /api/assistant in Assignment 2.
 */

import {
  SIMULATED_QA,
  INTENTS,
  FALLBACK_RESPONSES,
  RESTAURANT_INFO,
  SUGGESTED_QUESTIONS,
} from '../data/aiKnowledgeBase.js';
import { formatMoney } from '../utils/helpers.js';
import { orderedFrequency } from '../utils/analytics.js';

const QA_PRECEDENCE = 1.25;
const STOP_WORDS = new Set([
  'i', 'want', 'a', 'an', 'the', 'some', 'something', 'for', 'me', 'my', 'do', 'you', 'have',
  'any', 'what', 'whats', 'is', 'are', 'of', 'to', 'and', 'with', 'please', 'under', 'over',
  'than', 'less', 'more', 'dish', 'dishes', 'food', 'meal', 'meals', 'option', 'options', 'good',
  'there', 'we', 'your', 'our', 'best', 'much', 'how', 'cost', 'price', 'prices',
]);

const CATEGORY_WORDS = {
  starter: 'starters',
  starters: 'starters',
  main: 'mains',
  mains: 'mains',
  dessert: 'desserts',
  desserts: 'desserts',
  drink: 'beverages',
  drinks: 'beverages',
  beverage: 'beverages',
  beverages: 'beverages',
  pasta: 'mains',
  pizza: 'mains',
  salad: 'starters',
};

const DIET_WORDS = {
  vegetarian: 'vegetarian',
  veggie: 'vegetarian',
  vegan: 'vegan',
  'plant based': 'vegan',
  gluten: 'gluten-free',
  'gluten free': 'gluten-free',
  celiac: 'gluten-free',
  dairy: 'dairy-free',
  'dairy free': 'dairy-free',
  lactose: 'dairy-free',
  'nut free': 'nut-free',
  spicy: 'spicy',
  hot: 'spicy',
  chilli: 'spicy',
};

export function normalise(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9$'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word-boundary keyword matching, so 'hi' cannot match inside 'which' and a short keyword cannot
 * swallow an unrelated question. A trailing 's' is allowed (dessert / desserts, drink / drinks).
 */
function keywordScore(text, keywords = []) {
  return keywords.reduce((score, keyword) => {
    const needle = normalise(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!needle) return score;
    const pattern = new RegExp(`(^|\\s)${needle}s?(\\s|$)`, 'i');
    if (!pattern.test(text)) return score;
    // Multi-word phrases are a stronger signal than single words.
    return score + needle.split(' ').length;
  }, 0);
}

/* ------------------------------------------------------------------ helpers */

function available(items) {
  return items.filter((item) => item.available);
}

function toList(items, max = 4) {
  return items
    .slice(0, max)
    .map((item) => `${item.name} (${formatMoney(item.price)})`)
    .join(', ');
}

function priceRange(items) {
  if (items.length === 0) return 'no items';
  const prices = items.map((item) => item.price);
  return `${formatMoney(Math.min(...prices))} – ${formatMoney(Math.max(...prices))}`;
}

/* ------------------------------------------------- answer builders (context) */

/**
 * A builder returns a plain string when it answered the question. When it could not answer it returns
 * this object instead, which makes askAssistant attach the pre-set question list to the reply so the
 * customer can pick a question that is guaranteed to work.
 */
function noAnswer(text) {
  return { text, unresolved: true };
}


function buildContext({ menuItems, orders, preferences }) {
  const menu = available(menuItems);

  return {
    specials() {
      const specials = menuItems.filter((item) => item.todaySpecial && item.available);
      if (specials.length === 0) return noAnswer("No special is set for today — check back later today.");
      if (specials.length === 1) {
        return `Today's special is ${specials[0].name} for ${formatMoney(specials[0].price)}.`;
      }
      return `Today's specials are ${specials.map((s) => `${s.name} (${formatMoney(s.price)})`).join(', ')}.`;
    },

    byDiet(tag, heading) {
      const matches = menu.filter((item) => item.dietary.includes(tag));
      if (matches.length === 0) return noAnswer(`Sorry, we have no ${tag} dishes on the menu right now.`);
      return `${heading}: ${toList(matches, 5)}.`;
    },

    byBudget(question) {
      const budgetMatch = question.match(/(?:under|less than|max(?:imum)?|budget of|up to)\s*\$?(\d+(?:\.\d+)?)/);
      const budget = budgetMatch ? Number(budgetMatch[1]) : 20;

      const wantedTags = Object.entries(DIET_WORDS)
        .filter(([word]) => question.includes(word))
        .map(([word]) => DIET_WORDS[word]);

      const matches = menu
        .filter((item) => item.price <= budget)
        .filter((item) => wantedTags.every((tag) => item.dietary.includes(tag)))
        .sort((a, b) => b.popular - a.popular || a.price - b.price);

      if (matches.length === 0) {
        const cheapest = [...menu].sort((a, b) => a.price - b.price).slice(0, 3);
        return noAnswer(`Nothing on the menu matches that budget and those requirements. Our lowest priced dishes are ${toList(cheapest)}.`);
      }

      const tags = wantedTags.length > 0 ? ` matching ${wantedTags.join(' and ')}` : '';
      return `For under ${formatMoney(budget)}${tags} I recommend: ${toList(matches, 4)}.`;
    },

    allergy(question) {
      const dish = menuItems.find((item) => question.includes(normalise(item.name)));
      if (!dish) {
        return noAnswer(`Tell me which dish you mean and I will list its ingredients. ${RESTAURANT_INFO.disclaimer}`);
      }
      return `${dish.name} contains: ${dish.ingredients.join(', ')}. Dietary tags: ${dish.dietary.join(', ')}. ${RESTAURANT_INFO.disclaimer}`;
    },

    priceList() {
      const byCategory = ['starters', 'mains', 'desserts', 'beverages']
        .map((category) => `${category}: ${priceRange(menu.filter((item) => item.category === category))}`)
        .join('; ');
      return `Our price ranges — ${byCategory}.`;
    },

    searchMenu(question) {
      const tokens = question
        .split(' ')
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

      const categories = new Set(
        tokens.map((token) => CATEGORY_WORDS[token]).filter(Boolean),
      );

      let matches = menu.filter((item) =>
        tokens.some((token) =>
          normalise(`${item.name} ${item.description} ${item.ingredients.join(' ')} ${item.dietary.join(' ')}`).includes(token),
        ),
      );

      if (matches.length === 0 && categories.size > 0) {
        matches = menu.filter((item) => categories.has(item.category));
      }

      if (matches.length === 0) return null;
      return `On the menu: ${toList(matches, 4)}.`;
    },

    recommendations() {
      const ranked = orderedFrequency(orders);
      const fromHistory = ranked[0] ? [ranked[0].name, ranked[0].quantity] : null;
      const popularItem = [...menu].sort((a, b) => Number(b.popular) - Number(a.popular))[0];

      if (fromHistory && popularItem && fromHistory[0] === popularItem.name) {
        return `Based on popular orders, we recommend our ${popularItem.name}.`;
      }
      if (preferences.dietary.length > 0) {
        const tags = preferences.dietary;
        const matches = menu.filter((item) => tags.every((tag) => item.dietary.includes(tag)));
        if (matches.length > 0) {
          return `Based on your saved preferences (${tags.join(', ')}), try ${toList(matches, 3)}.`;
        }
      }
      if (fromHistory) {
        return `Your most ordered dish is ${fromHistory[0]} (${fromHistory[1]} times). Others customers love: ${toList(menu.filter((item) => item.popular), 3)}.`;
      }
      return `Based on popular orders, we recommend our ${popularItem?.name ?? 'Chef special'}.`;
    },

    previousOrder() {
      const completed = orders
        .filter((order) => order.status !== 'cancelled')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const last = completed[0];
      if (!last) return noAnswer("We don't have a previous order for you yet. Try our popular dishes!");
      const names = [...new Set(last.items.map((item) => item.name))];
      return `Your previous order was ${names.join(' and ')}.`;
    },
  };
}

/* --------------------------------------------------------------- main entry */

export function askAssistant(question, { menuItems = [], orders = [], preferences = { dietary: [] } } = {}) {
  const text = normalise(question);
  if (!text) {
    return { text: FALLBACK_RESPONSES[0], source: 'fallback', options: SUGGESTED_QUESTIONS };
  }

  let bestQA = null;
  SIMULATED_QA.forEach((entry) => {
    const score = keywordScore(text, entry.keywords) * QA_PRECEDENCE;
    if (score > 0 && (!bestQA || score > bestQA.score)) bestQA = { ...entry, score };
  });

  const context = buildContext({ menuItems, orders, preferences });

  let bestIntent = null;
  INTENTS.forEach((intent) => {
    const base = keywordScore(text, intent.keywords);
    const boost = intent.boost ? intent.boost(text) : 0;
    const score = base + boost;
    if (score <= 0) return;
    const built = intent.build(context, text);
    if (!built) return;
    const answer = typeof built === 'string' ? { text: built } : built;
    if (!answer.text) return;
    if (!bestIntent || score > bestIntent.score) {
      bestIntent = { score, id: intent.id, text: answer.text, unresolved: Boolean(answer.unresolved) };
    }
  });

  if (bestQA && (!bestIntent || bestQA.score >= bestIntent.score)) {
    return { text: bestQA.response, source: 'knowledge base', intent: bestQA.question };
  }
  if (bestIntent) {
    return {
      text: bestIntent.text,
      source: 'menu data',
      intent: bestIntent.id,
      // The intent matched the topic but found nothing usable: offer the pre-set questions instead.
      ...(bestIntent.unresolved ? { options: SUGGESTED_QUESTIONS } : {}),
    };
  }

  const index = Math.abs(hashCode(text)) % FALLBACK_RESPONSES.length;
  return { text: FALLBACK_RESPONSES[index], source: 'fallback', options: SUGGESTED_QUESTIONS };
}

/** Deterministic "random" fallback pick so the same question always gets the same reply. */
function hashCode(text) {
  return [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
}

export function assistantIntro() {
  return {
    text: `Hello! I am the ${RESTAURANT_INFO.name} AI assistant. I can answer questions about today's specials, dietary options, allergens, prices, delivery and reservations — or suggest what to order. Pick one of these to start:`,
    options: SUGGESTED_QUESTIONS,
  };
}
