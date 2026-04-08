import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema.js';
import { query } from '../db.js';

export const db = drizzle(
  async (sql, params, method) => {
    const rows = await query(sql, params as any);
    return { rows };
  },
  { schema }
);
