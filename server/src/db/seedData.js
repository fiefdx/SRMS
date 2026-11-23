/**
 * Demo dataset for `npm run seed` (scripts/seed.js).
 *
 * The menu and table rows mirror the Assignment 1 demo data so the API and the frontend demo show the
 * same restaurant; the records below add the users, orders, reservations and feedback that Assignment 2
 * needs for authorization, order history, reservation validation and admin analytics.
 *
 * Amounts (subtotal/total) are not written here — scripts/seed.js recalculates them with
 * src/services/pricing.js so seeded orders and API-created orders follow the same rules.
 */

export const MENU_SEED = [
  {
    "name": "Garden Salad",
    "category": "starter",
    "description": "Seasonal leaves, cucumber, cherry tomato and a lemon-olive oil dressing.",
    "ingredients": [
      "lettuce",
      "rocket",
      "cucumber",
      "cherry tomato",
      "olive oil",
      "lemon"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegetarian",
      "vegan",
      "gluten-free",
      "dairy-free",
      "nut-free"
    ],
    "price": 7.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🥗"
  },
  {
    "name": "Bruschetta al Pomodoro",
    "category": "starter",
    "description": "Grilled sourdough topped with marinated tomatoes, basil and garlic.",
    "ingredients": [
      "sourdough",
      "tomato",
      "basil",
      "garlic",
      "olive oil"
    ],
    "allergens": [
      "gluten"
    ],
    "dietaryTags": [
      "vegetarian",
      "nut-free",
      "dairy-free"
    ],
    "price": 8.49,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍅"
  },
  {
    "name": "Garlic Bread",
    "category": "starter",
    "description": "Warm ciabatta baked with herb butter and a sprinkle of parsley.",
    "ingredients": [
      "ciabatta",
      "butter",
      "garlic",
      "parsley"
    ],
    "allergens": [
      "gluten",
      "dairy"
    ],
    "dietaryTags": [
      "vegetarian",
      "nut-free"
    ],
    "price": 5.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🥖"
  },
  {
    "name": "Crispy Calamari",
    "category": "starter",
    "description": "Lightly fried squid with lemon aioli and a chilli mayo dip.",
    "ingredients": [
      "squid",
      "flour",
      "egg",
      "lemon",
      "mayonnaise",
      "chilli"
    ],
    "allergens": [
      "shellfish",
      "gluten",
      "egg"
    ],
    "dietaryTags": [
      "dairy-free",
      "nut-free"
    ],
    "price": 11.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🦑"
  },
  {
    "name": "Buffalo Cauliflower Bites",
    "category": "starter",
    "description": "Oven-baked cauliflower tossed in buffalo sauce with a vegan ranch dip.",
    "ingredients": [
      "cauliflower",
      "buffalo sauce",
      "chilli",
      "oat cream"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegan",
      "vegetarian",
      "gluten-free",
      "dairy-free",
      "nut-free",
      "spicy"
    ],
    "price": 9.49,
    "available": true,
    "todaySpecial": false,
    "emoji": "🌶️"
  },
  {
    "name": "Soup of the Day",
    "category": "starter",
    "description": "Chef's daily soup, served with a slice of house bread.",
    "ingredients": [
      "vegetable stock",
      "seasonal vegetables",
      "herbs"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegetarian",
      "vegan",
      "dairy-free",
      "nut-free"
    ],
    "price": 6.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍲"
  },
  {
    "name": "Chicken Alfredo",
    "category": "main",
    "description": "Fettuccine tossed in a creamy parmesan sauce with grilled chicken.",
    "ingredients": [
      "fettuccine",
      "chicken breast",
      "double cream",
      "parmesan",
      "butter",
      "garlic"
    ],
    "allergens": [
      "gluten",
      "dairy"
    ],
    "dietaryTags": [
      "nut-free"
    ],
    "price": 18.99,
    "available": true,
    "todaySpecial": true,
    "emoji": "🍝"
  },
  {
    "name": "Vegetable Pasta",
    "category": "main",
    "description": "Penne with sautéed courgette, pepper, spinach and a tomato passata.",
    "ingredients": [
      "penne",
      "courgette",
      "bell pepper",
      "spinach",
      "tomato passata",
      "garlic"
    ],
    "allergens": [
      "gluten"
    ],
    "dietaryTags": [
      "vegetarian",
      "vegan",
      "dairy-free",
      "nut-free"
    ],
    "price": 15.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍝"
  },
  {
    "name": "Margherita Pizza",
    "category": "main",
    "description": "Wood-fired sourdough base, San Marzano tomato, mozzarella and basil.",
    "ingredients": [
      "pizza dough",
      "tomato",
      "mozzarella",
      "basil",
      "olive oil"
    ],
    "allergens": [
      "gluten",
      "dairy"
    ],
    "dietaryTags": [
      "vegetarian",
      "nut-free"
    ],
    "price": 14.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍕"
  },
  {
    "name": "Grilled Salmon & Seasonal Vegetables",
    "category": "main",
    "description": "Scottish salmon fillet with roasted vegetables and a dill sauce.",
    "ingredients": [
      "salmon",
      "potato",
      "broccoli",
      "carrot",
      "dill",
      "olive oil"
    ],
    "allergens": [
      "fish"
    ],
    "dietaryTags": [
      "gluten-free",
      "dairy-free",
      "nut-free"
    ],
    "price": 22.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🐟"
  },
  {
    "name": "Spicy Arrabbiata Rigatoni",
    "category": "main",
    "description": "Rigatoni in a slow-cooked chilli and tomato sauce, finished with parsley.",
    "ingredients": [
      "rigatoni",
      "tomato",
      "chilli",
      "garlic",
      "olive oil",
      "parsley"
    ],
    "allergens": [
      "gluten"
    ],
    "dietaryTags": [
      "vegetarian",
      "vegan",
      "dairy-free",
      "nut-free",
      "spicy"
    ],
    "price": 16.49,
    "available": true,
    "todaySpecial": false,
    "emoji": "🔥"
  },
  {
    "name": "Classic Beef Burger & Fries",
    "category": "main",
    "description": "100% beef patty, cheddar, salad and sauce, served with skin-on fries.",
    "ingredients": [
      "beef patty",
      "brioche bun",
      "cheddar",
      "lettuce",
      "tomato",
      "potato"
    ],
    "allergens": [
      "gluten",
      "dairy"
    ],
    "dietaryTags": [
      "nut-free"
    ],
    "price": 17.25,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍔"
  },
  {
    "name": "Eggplant Parmigiana",
    "category": "main",
    "description": "Layered aubergine, tomato sauce and mozzarella, baked until golden.",
    "ingredients": [
      "aubergine",
      "tomato",
      "mozzarella",
      "parmesan",
      "basil"
    ],
    "allergens": [
      "dairy"
    ],
    "dietaryTags": [
      "vegetarian",
      "nut-free"
    ],
    "price": 15.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍆"
  },
  {
    "name": "Herb Roasted Chicken",
    "category": "main",
    "description": "Half chicken roasted with thyme and lemon, served with roast potatoes.",
    "ingredients": [
      "chicken",
      "thyme",
      "lemon",
      "potato",
      "butter"
    ],
    "allergens": [
      "dairy"
    ],
    "dietaryTags": [
      "gluten-free",
      "nut-free"
    ],
    "price": 19.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍗"
  },
  {
    "name": "Quinoa & Roasted Veggie Bowl",
    "category": "main",
    "description": "Quinoa, roasted squash, chickpeas and kale with a tahini drizzle.",
    "ingredients": [
      "quinoa",
      "squash",
      "chickpeas",
      "kale",
      "tahini",
      "lemon"
    ],
    "allergens": [
      "sesame"
    ],
    "dietaryTags": [
      "vegan",
      "vegetarian",
      "gluten-free",
      "dairy-free"
    ],
    "price": 14.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🥙"
  },
  {
    "name": "Chocolate Lava Cake",
    "category": "dessert",
    "description": "Warm chocolate sponge with a molten centre and vanilla ice cream.",
    "ingredients": [
      "dark chocolate",
      "butter",
      "flour",
      "egg",
      "sugar",
      "vanilla ice cream"
    ],
    "allergens": [
      "dairy",
      "gluten",
      "egg"
    ],
    "dietaryTags": [
      "vegetarian",
      "nut-free"
    ],
    "price": 8.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍫"
  },
  {
    "name": "Tiramisu",
    "category": "dessert",
    "description": "Espresso-soaked sponge with mascarpone cream and cocoa.",
    "ingredients": [
      "mascarpone",
      "espresso",
      "sponge",
      "cocoa",
      "egg"
    ],
    "allergens": [
      "dairy",
      "gluten",
      "egg"
    ],
    "dietaryTags": [
      "vegetarian",
      "nut-free"
    ],
    "price": 7.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍰"
  },
  {
    "name": "Berry Panna Cotta",
    "category": "dessert",
    "description": "Set cream with a raspberry and blueberry compote.",
    "ingredients": [
      "cream",
      "sugar",
      "raspberry",
      "blueberry",
      "gelatine"
    ],
    "allergens": [
      "dairy"
    ],
    "dietaryTags": [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ],
    "price": 7.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🫐"
  },
  {
    "name": "Gelato Trio",
    "category": "dessert",
    "description": "Three scoops of house gelato — ask for today's flavours.",
    "ingredients": [
      "milk",
      "sugar",
      "fruit purée"
    ],
    "allergens": [
      "dairy"
    ],
    "dietaryTags": [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ],
    "price": 6.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍨"
  },
  {
    "name": "Fresh Lemonade",
    "category": "beverage",
    "description": "Hand-squeezed lemons with mint and a touch of honey.",
    "ingredients": [
      "lemon",
      "mint",
      "honey",
      "sparkling water"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegan",
      "vegetarian",
      "gluten-free",
      "dairy-free",
      "nut-free"
    ],
    "price": 4.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍋"
  },
  {
    "name": "Sparkling Water",
    "category": "beverage",
    "description": "750 ml bottle of natural sparkling mineral water.",
    "ingredients": [
      "sparkling mineral water"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegan",
      "vegetarian",
      "gluten-free",
      "dairy-free",
      "nut-free"
    ],
    "price": 2.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "💧"
  },
  {
    "name": "House Red Wine",
    "category": "beverage",
    "description": "Glass of Chianti Classico — ask our staff for the bottle list.",
    "ingredients": [
      "grape"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegan",
      "vegetarian",
      "gluten-free",
      "dairy-free",
      "nut-free"
    ],
    "price": 7.99,
    "available": true,
    "todaySpecial": false,
    "emoji": "🍷"
  },
  {
    "name": "Artisan Coffee",
    "category": "beverage",
    "description": "Espresso, flat white or cappuccino from a single-origin roast.",
    "ingredients": [
      "coffee beans",
      "milk"
    ],
    "allergens": [
      "dairy"
    ],
    "dietaryTags": [
      "vegetarian",
      "gluten-free",
      "nut-free"
    ],
    "price": 3.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "☕"
  },
  {
    "name": "Mango Smoothie",
    "category": "beverage",
    "description": "Blended mango and banana with oat milk — no added sugar.",
    "ingredients": [
      "mango",
      "banana",
      "oat milk"
    ],
    "allergens": [],
    "dietaryTags": [
      "vegan",
      "vegetarian",
      "gluten-free",
      "dairy-free",
      "nut-free"
    ],
    "price": 6.5,
    "available": true,
    "todaySpecial": false,
    "emoji": "🥭"
  }
];

export const TABLE_SEED = [
  {
    "label": "Window 1",
    "seats": 2,
    "area": "window"
  },
  {
    "label": "Window 2",
    "seats": 2,
    "area": "window"
  },
  {
    "label": "Booth 1",
    "seats": 4,
    "area": "main"
  },
  {
    "label": "Booth 2",
    "seats": 4,
    "area": "main"
  },
  {
    "label": "Round 1",
    "seats": 6,
    "area": "main"
  },
  {
    "label": "Group table",
    "seats": 10,
    "area": "group"
  }
];

export const DEMO_PASSWORD = 'demo1234';

export const USER_SEED = [
  {
    name: 'Admin User',
    email: 'admin@srms.dev',
    role: 'admin',
    phone: '+1 555 0100',
    address: '12 Marina Way',
  },
  {
    name: 'Demo Customer',
    email: 'demo@srms.dev',
    role: 'customer',
    phone: '+1 555 0111',
    address: '48 Harbour Street',
    dietaryTags: ['vegetarian', 'nut-free'],
    favourites: ['Margherita Pizza', 'Berry Panna Cotta'],
  },
  {
    name: 'Ana Silva',
    email: 'ana@example.com',
    role: 'customer',
    phone: '+1 555 0122',
    address: '9 Vine Terrace',
    dietaryTags: ['gluten-free'],
    favourites: ['Grilled Salmon & Seasonal Vegetables'],
  },
];

/** daysAgo keeps the demo orders inside the 7-day window the admin analytics chart reads. */
export const ORDER_SEED = [
  {
    reference: 'ORD-1001',
    userEmail: 'demo@srms.dev',
    status: 'delivered',
    fulfilment: 'delivery',
    daysAgo: 6,
    notes: 'Doorbell is broken, please knock.',
    lines: [
      { name: 'Margherita Pizza', quantity: 1 },
      { name: 'Garlic Bread', quantity: 1 },
      { name: 'Fresh Lemonade', quantity: 2 },
    ],
  },
  {
    reference: 'ORD-1002',
    userEmail: 'demo@srms.dev',
    status: 'ready',
    fulfilment: 'pickup',
    daysAgo: 2,
    notes: '',
    lines: [
      { name: 'Chicken Alfredo', quantity: 1 },
      { name: 'Tiramisu', quantity: 1 },
    ],
  },
  {
    reference: 'ORD-1003',
    userEmail: 'demo@srms.dev',
    status: 'preparing',
    fulfilment: 'delivery',
    daysAgo: 0,
    notes: 'Extra napkins please.',
    lines: [
      { name: 'Margherita Pizza', quantity: 2 },
      { name: 'Crispy Calamari', quantity: 1 },
      { name: 'Sparkling Water', quantity: 2 },
    ],
  },
  {
    reference: 'ORD-1004',
    userEmail: 'ana@example.com',
    status: 'pending',
    fulfilment: 'delivery',
    daysAgo: 1,
    notes: 'Allergy: shellfish.',
    lines: [
      { name: 'Grilled Salmon & Seasonal Vegetables', quantity: 1 },
      { name: 'Garden Salad', quantity: 1 },
    ],
  },
  {
    reference: 'ORD-1005',
    userEmail: 'ana@example.com',
    status: 'cancelled',
    fulfilment: 'delivery',
    daysAgo: 4,
    notes: 'Cancelled by customer before preparation started.',
    lines: [{ name: 'Classic Beef Burger & Fries', quantity: 1 }],
  },
  /* A guest order: no account, but the contact details the checkout form collects. */
  {
    reference: 'ORD-1006',
    userEmail: null,
    contact: { name: 'Walk-in Guest', email: 'guest@example.com', phone: '+1 555 0133' },
    status: 'preparing',
    fulfilment: 'pickup',
    daysAgo: 0,
    notes: 'Placed without an account.',
    lines: [
      { name: 'Gelato Trio', quantity: 2 },
      { name: 'Artisan Coffee', quantity: 2 },
    ],
  },
];

/** reservationInDays is relative to "today" so the demo never shows stale dates. */
export const RESERVATION_SEED = [
  {
    reference: 'RES-5001',
    userEmail: 'demo@srms.dev',
    type: 'standard',
    tableLabel: 'Booth 1',
    reservationInDays: 0,
    startTime: '19:00',
    endTime: '20:30',
    partySize: 4,
    status: 'approved',
  },
  {
    reference: 'RES-5002',
    userEmail: 'demo@srms.dev',
    type: 'birthday',
    tableLabel: 'Group table',
    reservationInDays: 5,
    startTime: '18:30',
    endTime: '21:30',
    partySize: 10,
    occasion: "Maya's 30th birthday",
    requirements: 'Two high chairs, candles on the dessert, no shellfish dishes.',
    menuSelection: ['Bruschetta al Pomodoro', 'Chicken Alfredo', 'Berry Panna Cotta'],
    status: 'pending',
  },
  {
    reference: 'RES-5003',
    userEmail: 'ana@example.com',
    type: 'corporate',
    tableLabel: 'Round 1',
    reservationInDays: 9,
    startTime: '12:30',
    endTime: '14:00',
    partySize: 6,
    occasion: 'Quarterly team lunch',
    requirements: 'Projector in the room, vegetarian main for everyone.',
    menuSelection: ['Garden Salad', 'Vegetable Pasta'],
    status: 'approved',
  },
  {
    reference: 'RES-5004',
    userEmail: null,
    contact: { name: 'Walk-in Guest', email: 'guest@example.com', phone: '+1 555 0133' },
    type: 'group',
    tableLabel: 'Booth 2',
    reservationInDays: 3,
    startTime: '19:30',
    endTime: '21:00',
    partySize: 4,
    occasion: 'Anniversary dinner, booked as a guest',
    status: 'pending',
  },
];

/** sentiment stays null: the AI feedback analysis endpoint fills it in (bonus feature). */
export const FEEDBACK_SEED = [
  { orderReference: 'ORD-1001', rating: 5, comment: 'Pizza was excellent and the delivery was early.' },
  { orderReference: 'ORD-1002', rating: 2, comment: 'Pasta was cold when we collected it, disappointing.' },
  { orderReference: 'ORD-1004', rating: 4, comment: 'Salmon cooked well, dessert could be bigger.' },
];
