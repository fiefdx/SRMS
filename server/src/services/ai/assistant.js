/**
 * The backend AI assistant.
 *
 * It is a rule-based intent router in front of **live database facts**: the same six questions the
 * frontend assistant answers are answered here from the menu, order and reservation tables, so the answer
 * changes when the data changes (a dish switched off, a new daily special, an order that moved to
 * "preparing"). Signed-in customers get personal answers ("what did I order last time?"), guests get the
 * public facts, and anything the rules cannot resolve comes back as an honest fallback with the suggested
 * questions instead of a made-up answer.
 */
import {
  dishesMatching,
  findDish,
  myLatestOrder,
  myOrderReference,
  myUpcomingReservation,
  nextFreeTable,
  popularItems,
  priceRange,
  restaurantFacts,
  todaysSpecial,
} from './knowledge.js';

export const SUGGESTED_QUESTIONS = [
  "What are today's specials?",
  'What vegetarian meals do you have?',
  'What do you recommend?',
  'Do you have gluten-free options?',
  'What is the most popular dessert?',
  'What did I order last time?',
  'I want something spicy under $20',
  'What are your opening hours?',
];

const CURRENCY = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' });
const money = (value) => CURRENCY.format(Number(value));

const INTENTS = [
  { name: 'specials', keywords: ['special', 'specials', 'today', 'deal', 'offer'] },
  { name: 'dietary', keywords: ['vegetarian', 'veggie', 'vegan', 'gluten', 'gluten-free', 'dairy-free', 'nut-free', 'allerg', 'celiac'] },
  { name: 'recommend', keywords: ['recommend', 'recommendation', 'suggest', 'suggestion', 'favourite', 'favourite dish'] },
  { name: 'popularDessert', keywords: ['popular dessert', 'best dessert', 'dessert'] },
  { name: 'previousOrder', keywords: ['last time', 'previous order', 'ordered before', 'my order', 'last order', 'did i order'] },
  { name: 'orderStatus', keywords: ['where is my order', 'order status', 'my order status', 'is my order ready'] },
  { name: 'availability', keywords: ['table', 'book', 'booking', 'reserve', 'reservation', 'available', 'free'] },
  { name: 'hours', keywords: ['hour', 'hours', 'opening', 'open now', 'are you open', 'closing time', 'close at', 'what time'] },
  { name: 'delivery', keywords: ['delivery', 'deliver', 'pickup', 'collect', 'fee', 'minimum', 'tax'] },
  { name: 'price', keywords: ['price', 'prices', 'how much', 'cost', 'cheap', 'expensive', 'under', 'budget'] },
  { name: 'greeting', keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening'] },
];

/** Whole-word matching (with an optional trailing "s"), so "hi" does not match inside "which". */
function keywordScore(text, keywords) {
  let score = 0;
  for (const keyword of keywords) {
    const pattern = new RegExp(`(^|\\s)${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(\\s|[.,!?;]|$)`, 'i');
    if (pattern.test(text)) score += 1;
  }
  return score;
}

function matchIntent(text) {
  let best = null;
  for (const intent of INTENTS) {
    const score = keywordScore(text, intent.keywords);
    if (score > 0 && (!best || score > best.score)) best = { name: intent.name, score };
  }
  return best?.name ?? null;
}

const DIET_WORDS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'spicy'];

function detectDiet(text) {
  for (const diet of DIET_WORDS) if (text.includes(diet)) return diet;
  if (text.includes('gluten')) return 'gluten-free';
  if (text.includes('dairy')) return 'dairy-free';
  if (text.includes('nut')) return 'nut-free';
  if (text.includes('chilli') || text.includes('spicy')) return 'spicy';
  return null;
}

const BUDGET = /under\s+\$?\s?(\d+(\.\d+)?)/i;
const CATEGORY_WORDS = { starter: 'starter', starters: 'starter', main: 'main', mains: 'main', dessert: 'dessert', desserts: 'dessert', drink: 'beverage', drinks: 'beverage', beverage: 'beverage' };

function listOfDishes(dishes) {
  return dishes.map((dish) => `${dish.name} (${money(dish.price)})`).join(', ');
}

function unresolved(text) {
  return {
    text: `${text} You can try one of these:`,
    intent: 'fallback',
    sources: [],
    options: SUGGESTED_QUESTIONS,
  };
}

/**
 * @param question free text from the customer
 * @param actor    the signed-in account, or null for a guest
 */
export async function answerQuestion(question, actor = null, uri) {
  const text = String(question ?? '').trim().toLowerCase();
  if (!text) return unresolved('Please ask a question about the menu, an order or a booking.');

  const facts = restaurantFacts();
  const intent = matchIntent(text);
  const orderMatch = text.match(/\b(ord-\d{1,6})\b/i);

  /* ---- personal answers need an account ---- */
  if (orderMatch) {
    if (!actor) return { text: `Sign in and I can look up ${orderMatch[1].toUpperCase()} for you.`, intent: 'orderStatus', sources: ['auth'] };
    const order = await myOrderReference(actor.id, orderMatch[1].toUpperCase(), uri);
    if (!order) return { text: `I cannot find an order ${orderMatch[1].toUpperCase()} on your account.`, intent: 'orderStatus', sources: ['orders'] };
    return {
      text: `Order ${order.reference} is ${order.status}. ${order.items.map((line) => `${line.quantity} x ${line.name}`).join(', ')} — total ${money(order.total)}.`,
      intent: 'orderStatus',
      sources: ['orders'],
    };
  }

  if (intent === 'previousOrder') {
    if (!actor) return { text: 'Sign in and I can tell you what you ordered last time.', intent: 'previousOrder', sources: ['auth'] };
    const order = await myLatestOrder(actor.id, uri);
    if (!order) return { text: 'You have not placed an order with this account yet.', intent: 'previousOrder', sources: ['orders'] };
    return {
      text: `Your previous order was ${order.items.map((line) => line.name).join(' and ')} (${order.reference}).`,
      intent: 'previousOrder',
      sources: ['orders'],
    };
  }

  switch (intent) {
    case 'specials': {
      const special = await todaysSpecial(uri);
      if (!special) return unresolved("There is no special marked for today.");
      return { text: `Today's special is ${special.name} for ${money(special.price)} — ${special.description}`, intent: 'specials', sources: ['menu_items'] };
    }

    case 'popularDessert': {
      const popular = await popularItems({ limit: 20, days: 365 }, uri);
      const desserts = await dishesMatching({ category: 'dessert', limit: 20 }, uri);
      const ranked = desserts
        .map((dish) => ({ ...dish, ordered: popular.find((item) => item.name === dish.name)?.quantity ?? 0 }))
        .sort((a, b) => b.ordered - b.ordered || a.price - b.price)[0];
      if (!ranked) return unresolved('We have no desserts on the menu at the moment.');
      return {
        text: `Our most popular dessert is ${ranked.name} at ${money(ranked.price)}${ranked.ordered ? ` (${ranked.ordered} ordered in the last year)` : ''}.`,
        intent: 'popularDessert',
        sources: ['order_items', 'menu_items'],
      };
    }

    case 'recommend': {
      const popular = await popularItems({ limit: 1, days: 365 }, uri);
      if (popular.length === 0) {
        const fallback = await dishesMatching({ limit: 1 }, uri);
        return { text: `We have not had orders to learn from yet, but ${fallback[0]?.name ?? 'our kitchen specials'} is a good place to start.`, intent: 'recommend', sources: ['menu_items'] };
      }
      return { text: `Based on real orders, we recommend our ${popular[0].name} — ${popular[0].quantity} ordered recently.`, intent: 'recommend', sources: ['order_items'] };
    }

    case 'dietary': {
      const diet = detectDiet(text);
      if (!diet) return unresolved('Tell me which diet you need — vegetarian, vegan, gluten-free, dairy-free or nut-free.');
      const dishes = await dishesMatching({ dietary: diet, limit: 4 }, uri);
      if (dishes.length === 0) return unresolved(`I cannot find a ${diet} dish on the menu right now.`);
      return { text: `Yes. Our ${diet} dishes include ${listOfDishes(dishes)}.`, intent: 'dietary', sources: ['menu_items'] };
    }

    case 'price': {
      const budget = BUDGET.exec(text);
      const category = Object.entries(CATEGORY_WORDS).find(([word]) => new RegExp(`(^|\\s)${word}s?(\\s|[.,!?;]|$)`, 'i').test(text))?.[1];
      const diet = detectDiet(text);

      if (budget) {
        const dishes = await dishesMatching({ maxPrice: Number(budget[1]), category, dietary: diet, limit: 4 }, uri);
        if (dishes.length === 0) return unresolved(`Nothing on the menu is under ${money(budget[1])} for that request.`);
        return { text: `Under ${money(budget[1])}: ${listOfDishes(dishes)}.`, intent: 'price', sources: ['menu_items'] };
      }

      if (diet || category) {
        const dishes = await dishesMatching({ dietary: diet, category, limit: 4 }, uri);
        if (dishes.length === 0) return unresolved('I could not match that request to the menu.');
        return { text: `${listOfDishes(dishes)}.`, intent: 'price', sources: ['menu_items'] };
      }

      const dishName = text.replace(/[^a-z\s&]/g, '').trim();
      const dish = dishName.length > 3 ? await findDish(dishName, uri) : null;
      if (dish) return { text: `${dish.name} is ${money(dish.price)}.${dish.available ? '' : ' It is not available right now.'}`, intent: 'price', sources: ['menu_items'] };

      const range = await priceRange(uri);
      return {
        text: `Dishes run from ${money(range.cheapest)} to ${money(range.dearest)} across ${range.dishes} menu items. Prices exclude the ${facts.taxPercent} tax.`,
        intent: 'price',
        sources: ['menu_items'],
      };
    }

    case 'hours': {
      const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
      const entry = facts.openingHours.find((hours) => hours.day === today);
      const todayText = entry?.open ? `${today}: ${entry.open} to ${entry.close}` : `${today}: closed`;
      return { text: `${todayText}. The rest of the week: ${facts.openingHours.map((h) => `${h.day} ${h.open ? `${h.open}-${h.close}` : 'closed'}`).join(', ')}.`, intent: 'hours', sources: ['config'] };
    }

    case 'delivery': {
      return {
        text: `Delivery is ${money(facts.deliveryFee)} and free over ${money(facts.freeDeliveryFrom)}; pickup is always free. Tax is ${facts.taxPercent}.`,
        intent: 'delivery',
        sources: ['pricing'],
      };
    }

    case 'availability': {
      if (actor) {
        const upcoming = await myUpcomingReservation(actor.id, uri);
        if (upcoming) {
          return {
            text: `Your next booking is ${upcoming.reference} on ${upcoming.date} at ${upcoming.startTime} for ${upcoming.partySize} guests (${upcoming.status}).`,
            intent: 'availability',
            sources: ['reservations'],
          };
        }
      }

      const party = Number(text.match(/for\s+(\d{1,2})/)?.[1] ?? 2);
      const free = await nextFreeTable(party, uri);
      if (!free) return unresolved(`I could not find a free table for ${party} in the next two weeks.`);
      return {
        text: `A ${free.table.label} (seats ${free.table.seats}) is free on ${free.weekday} ${free.date} from ${free.startTime} to ${free.endTime}. Ask me to book it, or use the reservations form.`,
        intent: 'availability',
        sources: ['restaurant_tables', 'reservations'],
      };
    }

    case 'greeting':
      return {
        text: `Hello — I can help with ${facts.name}'s menu, your orders and bookings. Try one of these:`,
        intent: 'greeting',
        sources: ['config'],
        options: SUGGESTED_QUESTIONS,
      };

    default:
      return unresolved("I am not sure how to answer that yet.");
  }
}
