/*
 * Central configuration. Every value can be overridden with an environment variable (or a local
 * server/.env file, see .env.example) so the same code runs in development, in tests and on a
 * hosting service such as Render.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(serverRoot, '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const jwtSecret = process.env.JWT_SECRET || 'srms-dev-secret-change-me';

if (isProduction && jwtSecret === 'srms-dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production. Refusing to start with the development secret.');
}

export const config = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  db: {
    client: process.env.DB_CLIENT || 'mongodb',
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/srms',
    mysqlUri: process.env.MYSQL_URI || 'mysql://root@localhost:3306/srms',
  },
  /* Values that mirror the frontend demo data; the database layer seeds with these. */
  restaurant: {
    name: process.env.RESTAURANT_NAME || 'Bella Vista',
    openingHours: [
      { day: 'Monday', open: null, close: null },
      { day: 'Tuesday', open: '12:00', close: '22:00' },
      { day: 'Wednesday', open: '12:00', close: '22:00' },
      { day: 'Thursday', open: '12:00', close: '22:00' },
      { day: 'Friday', open: '12:00', close: '23:00' },
      { day: 'Saturday', open: '12:00', close: '23:00' },
      { day: 'Sunday', open: '16:00', close: '21:00' },
    ],
    maxPartySize: Number(process.env.MAX_PARTY_SIZE || 12),
  },
};

export default config;
