import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1) Define the users table
const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

// 2) Describe your Env interface
export interface Env {
  DB: D1Database;
  "baccarat-master": Queue;
}

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB);
    const url = new URL(request.url);

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

      return Response.json(newUser);
    }

    // Route to get all users
    if (url.pathname === '/users') {
      const allUsers = await db.select().from(users).all();
      return Response.json(allUsers);
    }

    // Default route
    return new Response('D1 Connected!');
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      console.log(`Received message from queue: ${JSON.stringify(message.body)}`);
      // Add your queue processing logic here
    }
  }
};
