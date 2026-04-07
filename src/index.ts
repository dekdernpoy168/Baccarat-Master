import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1) Define the users table
const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

// Define articles table
const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  excerpt: text('excerpt'),
  content: text('content'),
  image: text('image'),
  category: text('category'),
  tags: text('tags'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  metaKeywords: text('meta_keywords'),
  author: text('author'),
  status: text('status'),
  date: text('date'),
  publishedAt: text('published_at'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

// Define categories table
const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

// 2) Describe your Env interface
export interface Env {
  DB: D1Database;
  "baccarat-master": Queue;
  ANALYTICS_ENGINE: AnalyticsEngineDataset;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}

// --- Helper Functions ---
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default {
  async fetch(request: Request, env: Env) {
    // Log analytics data point
    env.ANALYTICS_ENGINE.writeDataPoint({
      blobs: ["Bangkok", "TH"],       // ข้อมูล string (dimensions)
      doubles: [1, 120.5],             // ข้อมูลตัวเลข
      indexes: ["user_123"]            // ใช้สำหรับ sampling
    });

    const url = new URL(request.url);
    const method = request.method;

    // CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const db = drizzle(env.DB);

    // Route to get all articles
    if (url.pathname === '/api/articles' && request.method === 'GET') {
      const allArticles = await db.select().from(articles).all();
      return json(allArticles);
    }

    // Route to get all categories
    if (url.pathname === '/api/categories' && request.method === 'GET') {
      const allCategories = await db.select().from(categories).all();
      return json(allCategories);
    }

    // Route to get analytics visits
    if (url.pathname === '/api/analytics/visits' && request.method === 'GET') {
      const query = `
        SELECT
          blob1 AS city,
          SUM(double1) AS total_visits
        FROM analytic_events
        WHERE timestamp > NOW() - INTERVAL '1' DAY
        GROUP BY blob1
      `;
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/sql',
        },
        body: query,
      });
      const data = await response.json();
      return json(data);
    }

    // Route to create the users table if it doesn't exist
    if (url.pathname === '/setup') {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);
      return new Response('Table created or already exists!');
    }

    // Route to add a test user
    if (url.pathname === '/add') {
      const newUser = await db.insert(users)
        .values({ name: 'Test User' })
        .returning()
        .get();

      return json(newUser);
    }

    // Route to get all users
    if (url.pathname === '/users') {
      const allUsers = await db.select().from(users).all();
      return json(allUsers);
    }

    // Default route: Return 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      console.log(`Received message from queue: ${JSON.stringify(message.body)}`);
      // Add your queue processing logic here
    }
  }
};
