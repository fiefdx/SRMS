/**
 * Simulated AI knowledge base (Assignment 1, option 2 of the brief: "Simulate the AI locally").
 *
 * The six question/response pairs required by the brief are kept verbatim in SIMULATED_QA so the
 * chat component can be demonstrated exactly as specified. The INTENTS array then extends the
 * assistant with menu-aware answers (prices, dietary filters, budget requests) by reading the same
 * menu data the rest of the app uses — that is what makes the assistant feel "live" without any
 * external API. In the final project this module is replaced by a call to the AI service
 * (Gemini / Groq / Ollama) exposed through our own backend.
 */

export const SIMULATED_QA = [
  {
    question: "What are today's specials?",
    response: "Today's special is Chicken Alfredo for $18.99.",
    keywords: ['special', 'specials', 'today', "today's", 'deal', 'offer'],
  },
  {
    question: 'What vegetarian meals do you have?',
    response: 'We offer Vegetable Pasta, Margherita Pizza, and Garden Salad.',
    keywords: ['vegetarian', 'veggie', 'meat free', 'meat-free'],
  },
  {
    question: 'What do you recommend?',
    response: 'Based on popular orders, we recommend our Chicken Alfredo.',
    keywords: ['recommend', 'recommendation', 'suggest', 'best dish', 'popular dish', 'favourite'],
  },
  {
    question: 'Do you have gluten-free options?',
    response: 'Yes. We offer gluten-free pasta and selected salads.',
    keywords: ['gluten', 'gluten-free', 'celiac'],
  },
  {
    question: 'What is the most popular dessert?',
    response: 'Our Chocolate Lava Cake is our most popular dessert.',
    keywords: ['popular dessert', 'best dessert', 'most popular dessert', 'dessert popular'],
  },
  {
    question: 'What did I order last time?',
    response: 'Your previous order was Chicken Alfredo and Chocolate Lava Cake.',
    keywords: ['last time', 'previous order', 'ordered before', 'my order', 'last order'],
  },
];

export const RESTAURANT_INFO = {
  name: 'Bella Vista',
  tagline: 'Modern Italian kitchen, neighbourhood restaurant',
  phone: '+44 20 7946 0102',
  email: 'hello@bellavista.dev',
  address: '18 Riverside Walk, London SE1 4PG',
  hours: [
    { day: 'Monday', hours: 'Closed' },
    { day: 'Tuesday – Thursday', hours: '12:00 – 22:00' },
    { day: 'Friday – Saturday', hours: '12:00 – 23:30' },
    { day: 'Sunday', hours: '12:30 – 21:00' },
  ],
  delivery: {
    fee: 3.5,
    freeFrom: 40,
    radius: '5 miles',
    eta: '35–50 minutes',
  },
  pickup: { eta: '20–30 minutes' },
  disclaimer:
    'Allergen information is provided as a guide. Please tell our team about any allergy before ordering.',
};

/** Quick questions shown as chips under the chat input. */
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

/**
 * Extra intents handled by rules rather than a fixed answer, so the assistant can answer from the
 * live menu/orders state. `build` returns the reply text.
 */
export const INTENTS = [
  {
    id: 'budget',
    label: 'Budget request',
    keywords: ['under', 'budget', 'less than', 'cheaper', 'affordable', 'cheap', 'max'],
    boost: (text) => (/under \$?\d+|budget of \$?\d+|max(imum)? \$?\d+/.test(text) ? 3 : 0),
    build: (ctx, text) => ctx.byBudget(text),
  },
  {
    id: 'spicy',
    label: 'Spicy food',
    keywords: ['spicy', 'hot', 'chilli', 'chili', 'hot dish'],
    build: (ctx) => ctx.byDiet('spicy', 'Spicy dishes on the menu'),
  },
  {
    id: 'vegan',
    label: 'Vegan',
    keywords: ['vegan', 'plant based', 'plant-based', 'no dairy'],
    build: (ctx) => ctx.byDiet('vegan', 'Vegan dishes on the menu'),
  },
  {
    id: 'dairy',
    label: 'Dairy free',
    keywords: ['dairy free', 'dairy-free', 'lactose', 'no milk'],
    build: (ctx) => ctx.byDiet('dairy-free', 'Dairy-free dishes on the menu'),
  },
  {
    id: 'allergy',
    label: 'Allergens / ingredients',
    keywords: ['allergy', 'allergen', 'allergies', 'ingredient', 'ingredients', 'nuts', 'what is in', 'contains'],
    build: (ctx, text) => ctx.allergy(text),
  },
  {
    id: 'previous-order',
    label: 'Previous order',
    keywords: ['recently ordered', 'ordered recently', 'order history', 'my previous', 'my last order'],
    build: (ctx) => ctx.previousOrder(),
  },
  {
    id: 'hours',
    label: 'Opening hours',
    keywords: ['hour', 'hours', 'open', 'opening', 'close', 'closing', 'when are you'],
    build: () => `Our opening hours: ${RESTAURANT_INFO.hours.map((h) => `${h.day}: ${h.hours}`).join('; ')}.`,
  },
  {
    id: 'location',
    label: 'Location and contact',
    keywords: ['where', 'address', 'location', 'contact', 'phone', 'find you', 'directions'],
    build: () =>
      `You can find us at ${RESTAURANT_INFO.address}. Phone ${RESTAURANT_INFO.phone}, email ${RESTAURANT_INFO.email}.`,
  },
  {
    id: 'delivery',
    label: 'Delivery and pickup',
    keywords: ['delivery', 'deliver', 'pickup', 'pick up', 'collect', 'takeaway', 'how long'],
    build: () =>
      `Delivery covers a ${RESTAURANT_INFO.delivery.radius} radius and costs $${RESTAURANT_INFO.delivery.fee.toFixed(2)} (free over $${RESTAURANT_INFO.delivery.freeFrom}). It usually takes ${RESTAURANT_INFO.delivery.eta}. Pickup is ready in about ${RESTAURANT_INFO.pickup.eta}.`,
  },
  {
    id: 'reservation',
    label: 'Reservations',
    keywords: ['reserve', 'reservation', 'book', 'booking', 'table', 'seats', 'private event', 'birthday party'],
    build: () =>
      'Yes — you can book a table or a special event from the Reservations page. Choose a date, time and party size and we will confirm the booking. For 10+ guests we suggest our group table.',
  },
  {
    id: 'menu-price',
    label: 'Prices',
    keywords: ['price', 'how much', 'cost', 'expensive', 'cheap drink'],
    build: (ctx) => ctx.priceList(),
  },
  {
    id: 'menu-item',
    label: 'Specific dish',
    keywords: ['what is in', 'alcohol', 'drink', 'dessert', 'starter', 'main course', 'beverage', 'salad', 'pizza', 'pasta', 'coffee'],
    build: (ctx, text) => ctx.searchMenu(text),
  },
  {
    id: 'greeting',
    label: 'Greeting',
    keywords: ['hello', 'hi', 'hey', 'good evening', 'good afternoon'],
    build: () => `Hi! I am the ${RESTAURANT_INFO.name} assistant. Ask me about the menu, allergens, prices or booking a table.`,
  },
];

export const FALLBACK_RESPONSES = [
  "I'm not sure about that one yet. You can ask me about today's specials, vegetarian or gluten-free dishes, popular desserts, allergens, prices, delivery or reservations.",
  "I don't have that answer in my knowledge base yet. Try asking about our menu, a dietary requirement, or booking a table.",
];
