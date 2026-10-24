/**
 * Seed data for Assignment 1.
 *
 * The app persists its state in localStorage; on the very first run these records are used so the
 * admin dashboard and the AI assistant have something meaningful to work with. In Assignment 2 the
 * seed is moved to database seed scripts.
 */

const today = new Date();
const iso = (offsetDays) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

export const SEED_ORDERS = [
  {
    id: 'ORD-1042',
    customerName: 'Alex Lee',
    email: 'alex@example.com',
    phone: '07700 900123',
    type: 'delivery',
    address: '14 Maple Street, Apt 3',
    notes: '',
    items: [
      { id: 'm-07', name: 'Chicken Alfredo', price: 18.99, quantity: 1 },
      { id: 'm-16', name: 'Chocolate Lava Cake', price: 8.5, quantity: 1 },
    ],
    subtotal: 27.49,
    deliveryFee: 3.5,
    tax: 2.48,
    total: 33.47,
    status: 'delivered',
    createdAt: iso(-6),
    placedBy: 'demo-customer',
  },
  {
    id: 'ORD-1043',
    customerName: 'Priya Nair',
    email: 'priya@example.com',
    phone: '07700 900456',
    type: 'pickup',
    address: '',
    notes: 'Pick up at 19:30 please.',
    items: [
      { id: 'm-09', name: 'Margherita Pizza', price: 14.99, quantity: 2 },
      { id: 'm-20', name: 'Fresh Lemonade', price: 4.5, quantity: 2 },
    ],
    subtotal: 38.98,
    deliveryFee: 0,
    tax: 3.51,
    total: 42.49,
    status: 'preparing',
    createdAt: iso(0),
    placedBy: 'demo-customer',
  },
  {
    id: 'ORD-1044',
    customerName: 'Alex Lee',
    email: 'alex@example.com',
    phone: '07700 900123',
    type: 'delivery',
    address: '14 Maple Street, Apt 3',
    notes: 'Extra napkins thanks.',
    items: [
      { id: 'm-07', name: 'Chicken Alfredo', price: 18.99, quantity: 2 },
      { id: 'm-24', name: 'Mango Smoothie', price: 6.5, quantity: 1 },
    ],
    subtotal: 44.48,
    deliveryFee: 3.5,
    tax: 4,
    total: 47.98,
    status: 'ready',
    createdAt: iso(-1),
    placedBy: 'demo-customer',
  },
];

export const SEED_RESERVATIONS = [
  {
    id: 'RES-501',
    customerName: 'Sofia Ramos',
    email: 'sofia@example.com',
    phone: '07700 900789',
    date: iso(2).slice(0, 10),
    time: '19:00',
    guests: 4,
    type: 'standard',
    requirements: '',
    tableId: 't-3',
    status: 'approved',
    createdAt: iso(-1),
  },
  {
    id: 'RES-502',
    customerName: 'Daniel Osei',
    email: 'daniel@example.com',
    phone: '07700 900321',
    date: iso(4).slice(0, 10),
    time: '18:30',
    guests: 10,
    type: 'corporate',
    requirements: 'Project dinner — needs a projector and two vegetarian mains.',
    tableId: 't-6',
    status: 'pending',
    createdAt: iso(0),
  },
];

export const SEED_FEEDBACK = [
  {
    id: 'fb-1',
    orderId: 'ORD-1042',
    customerName: 'Alex Lee',
    rating: 5,
    comment: 'The Chicken Alfredo was excellent and the delivery arrived hot. Lava cake was perfect.',
    createdAt: iso(-5),
  },
  {
    id: 'fb-2',
    orderId: 'ORD-1043',
    customerName: 'Priya Nair',
    rating: 3,
    comment: 'Pizza was tasty but the pickup took longer than the estimated time.',
    createdAt: iso(0),
  },
];
