/**
 * Verification script for the simulated AI assistant (run with: npm run check:ai).
 *
 * The first block checks the question/response pairs required by the Assignment 1 brief word for
 * word against the current menu/seed data. The second block shows the rule-based answers the
 * assistant generates from live data (budget, allergens, hours, preferences…).
 */
import { askAssistant } from '../src/services/aiAssistant.js';
import { MENU_ITEMS } from '../src/data/menuData.js';
import { SEED_ORDERS } from '../src/data/seedData.js';

const context = { menuItems: MENU_ITEMS, orders: SEED_ORDERS, preferences: { dietary: [] } };

const REQUIRED = [
  ["What are today's specials?", "Today's special is Chicken Alfredo for $18.99."],
  ['What vegetarian meals do you have?', 'We offer Vegetable Pasta, Margherita Pizza, and Garden Salad.'],
  ['What do you recommend?', 'Based on popular orders, we recommend our Chicken Alfredo.'],
  ['Do you have gluten-free options?', 'Yes. We offer gluten-free pasta and selected salads.'],
  ['What is the most popular dessert?', 'Our Chocolate Lava Cake is our most popular dessert.'],
  ['What did I order last time?', 'Your previous order was Chicken Alfredo and Chocolate Lava Cake.'],
];

const EXTRA = [
  'I want something spicy under $20',
  'What is in Chicken Alfredo?',
  'How much do your mains cost?',
  'What are your opening hours?',
  'Do you deliver?',
  'Can I book a table for a birthday party?',
  'What have I ordered recently?',
  'Can you help me with the weather?',
];

let failures = 0;

console.log('\nBrief-required question/response pairs');
console.log('--------------------------------------');
for (const [question, expected] of REQUIRED) {
  const answer = askAssistant(question, context);
  const ok = answer.text === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  Q: ${question}`);
  console.log(`      A: ${answer.text}`);
  if (!ok) console.log(`   want: ${expected}`);
}

console.log('\nRule based answers generated from the live menu/order data');
console.log('----------------------------------------------------------');
for (const question of EXTRA) {
  const answer = askAssistant(question, context);
  console.log(`Q: ${question}   [${answer.source}]`);
  console.log(`A: ${answer.text}\n`);
}

console.log(failures === 0 ? 'All required AI responses verified.\n' : `${failures} mismatch(es).\n`);
process.exit(failures === 0 ? 0 : 1);
