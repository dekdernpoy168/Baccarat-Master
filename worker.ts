// =============================================
// Cloudflare Worker API with D1 and Drizzle ORM
// Project: Baccarat Master Guide
// =============================================

import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, asc, min, notInArray, sql } from 'drizzle-orm';
import * as schema from './src/db/schema';
import { DurableObject, WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
  WEBSOCKET_MANAGER: DurableObjectNamespace<WebSocketManager>;
  MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
  SEND_EMAIL: any; // Email Rendering or Forwarding binding
  HYPERDRIVE: { connectionString: string };
  IMAGES: any;
  BUCKET: R2Bucket;
  AI: any;
  MY_WORKFLOW: any;
  MY_QUEUE: any;
  ASSETS?: Fetcher; // Supported when using Cloudflare Pages
}

type Params = {};

// --- Cloudflare Workflows (Example) ---
export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    await step.do("my first step", async () => {
      // ...
    });
    await step.do("my second step", async () => {
      // ...
    });
  }
}

// --- My Durable Object (Tutorial Example) ---
export class MyDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async sayHello(): Promise<string> {
    const result = this.ctx.storage.sql
      .exec("SELECT 'Hello from Durable Object SQLite!' as greeting")
      .one();
    return result.greeting as string;
  }
}

// --- WebSocket Manager (Durable Object) ---
export class WebSocketManager extends DurableObject<Env> {
  sessions: WebSocket[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // Internal endpoint to broadcast messages to all connected clients
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.text();
      // Clean up closed sessions
      this.sessions = this.sessions.filter(ws => ws.readyState === WebSocket.OPEN);
      // Broadcast
      this.sessions.forEach(ws => {
        try { ws.send(payload); } catch (e) {}
      });
      return new Response('OK');
    }

    // Handle WebSocket upgrade requests
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    server.accept();
    this.sessions.push(server);

    server.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

// --- Helper: Broadcast to WebSockets ---
async function broadcast(env: Env, message: any) {
  try {
    if (!env.WEBSOCKET_MANAGER) return;
    const id = env.WEBSOCKET_MANAGER.idFromName('global');
    const obj = env.WEBSOCKET_MANAGER.get(id);
    await obj.fetch(new Request('https://do/broadcast', {
      method: 'POST',
      body: JSON.stringify(message)
    }));
  } catch (e) {
    console.error('Broadcast error:', e);
  }
}

// --- Helper: JSON Response ---
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

// --- Helper: CORS Preflight ---
function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// --- Route Handler ---
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS
    if (method === 'OPTIONS') return handleCORS();

    // GET /ws — WebSocket Connection
    if (path === '/ws') {
      if (!env.WEBSOCKET_MANAGER) {
        return error('WebSocket Manager not configured', 500);
      }
      const id = env.WEBSOCKET_MANAGER.idFromName('global');
      const obj = env.WEBSOCKET_MANAGER.get(id);
      return obj.fetch(request);
    }

    // Initialize Drizzle ORM with D1
    const db = drizzle(env.DB, { schema });

    // Normalize path: remove trailing slash and optional /api prefix
    const isApiRequest = path.startsWith("/api");
    const isWebSocket = path === "/ws";
    
    let normalizedPath = path.replace(/\/$/, "");
    if (isApiRequest) {
      normalizedPath = normalizedPath.replace("/api", "");
    }
    if (normalizedPath === "") normalizedPath = "/";

    // Handle non-API requests (static assets/SPA)
    if (!isApiRequest && !isWebSocket) {
      if (env.ASSETS) {
        try {
          const response = await env.ASSETS.fetch(request.clone() as unknown as Request);
          
          // SPA Fallback: If it's a 404 and not a file, serve index.html
          const url = new URL(request.url);
          const lastSegment = url.pathname.split('/').pop() || '';
          if (response.status === 404 && !lastSegment.includes('.')) {
            return await env.ASSETS.fetch(new URL('/', request.url));
          }
          
          // If we got the asset, return it!
          if (response.status !== 404) return response;
        } catch (e) {
          console.error("Error fetching from ASSETS:", e);
        }
      }

      // Root path returns status JSON if no assets or if specifically requested as JSON
      if (normalizedPath === "/") {
        return json({ 
          status: 'ok', 
          message: 'Baccarat Master API is running.',
          endpoints: ['/api/articles', '/api/categories', '/api/auth/me'],
          setup: {
            d1_db: !!env.DB,
            assets: !!env.ASSETS,
            websocket_manager: !!env.WEBSOCKET_MANAGER
          }
        });
      }

      // Final fallback for missing assets or paths
      return new Response('Asset not found or configuration incomplete.', { status: 404 });
    }

    try {
      // =============================================
      // TEST D1 ENDPOINTS (User Requested)
      // =============================================
      
      // /api/setup: Create users table if not exists
      if (normalizedPath === '/setup' && method === 'GET') {
        const db = drizzle(env.DB);
        await db.run(sql`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
          )
        `);
        return new Response('Table created or already exists!');
      }

      // /api/add: Add a test user
      if (normalizedPath === '/add' && method === 'GET') {
        const db = drizzle(env.DB);
        const newUser = await db.insert(schema.users)
          .values({ name: 'Test User' })
          .returning()
          .get();

        return json(newUser);
      }

      // /api/users: Get all users
      if (normalizedPath === '/users' && method === 'GET') {
        const db = drizzle(env.DB);
        const allUsers = await db.select().from(schema.users).all();
        return json(allUsers);
      }

      // /api/do-test: Test the new Durable Object
      if (normalizedPath === '/do-test' && method === 'GET') {
        const id = env.MY_DURABLE_OBJECT.idFromName('test');
        const stub = env.MY_DURABLE_OBJECT.get(id);
        const greeting = await stub.sayHello();
        return new Response(greeting);
      }

      // /api/hyperdrive-test: Test Hyperdrive connection
      if (normalizedPath === '/hyperdrive-test' && method === 'GET') {
        return json({ 
          message: 'Hyperdrive binding configured', 
          connectionString: env.HYPERDRIVE?.connectionString || 'Not set' 
        });
      }

      // /api/images-test: Placeholder for Images API (Basic check)
      if (normalizedPath === '/images-test' && method === 'GET') {
        return json({ message: 'Cloudflare Images binding detected' });
      }

      // /api/workflow-test: Trigger a new workflow instance
      if (normalizedPath === '/workflow-test' && method === 'GET') {
        const instance = await env.MY_WORKFLOW.create();
        return json({
          id: instance.id,
          details: await instance.status(),
        });
      }

      // /api/queue-test: Send a message to the Queue
      if (normalizedPath === '/queue-test') {
        await env.MY_QUEUE.send({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers),
          timestamp: new Date().toISOString()
        });
        return json({ message: 'Message sent to Queue!' });
      }

      // =============================================
      // HEALTH CHECK / API FALLBACK
      // =============================================
      if ((normalizedPath === '/health' || (normalizedPath === '/' && isApiRequest)) && method === 'GET') {
        return json({ 
          status: 'ok', 
          message: 'Baccarat Master API is running.',
          endpoints: ['/api/articles', '/api/categories', '/api/auth/me']
        });
      }

      // =============================================
      // ARTICLES API
      // =============================================

      // GET /articles — List all articles
      if (normalizedPath === '/articles' && method === 'GET') {
        const results = await db.query.articles.findMany({
          orderBy: [desc(schema.articles.createdAt)],
        });
        return json(results);
      }

      // GET /articles/:id — Get single article
      const articleIdMatch = normalizedPath.match(/^\/articles\/(\d+)$/);
      if (articleIdMatch && method === 'GET') {
        const id = parseInt(articleIdMatch[1], 10);
        const row = await db.query.articles.findFirst({
          where: eq(schema.articles.id, id),
        });

        if (!row) return error('Article not found', 404);
        return json(row);
      }

      // POST /articles — Create article
      if (normalizedPath === '/articles' && method === 'POST') {
        const body = await request.json() as any;
        const now = new Date().toISOString();

        const result = await db.insert(schema.articles).values({
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt || null,
          content: body.content || '',
          image: body.image || null,
          category: body.category || null,
          tags: body.tags || '',
          metaTitle: body.metaTitle || null,
          metaDescription: body.metaDescription || null,
          metaKeywords: body.metaKeywords || null,
          author: body.author || 'Admin',
          type: body.type || 'post',
          status: body.status || 'draft',
          date: body.date || now.split('T')[0],
          publishedAt: body.publishedAt || null,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: schema.articles.id });

        await broadcast(env, { type: 'ARTICLE_CREATED', id: result[0].id });
        return json({ id: result[0].id, message: 'Article created' }, 201);
      }

      // PUT /articles/:id — Update article
      if (articleIdMatch && method === 'PUT') {
        const id = parseInt(articleIdMatch[1], 10);
        const body = await request.json() as any;
        const now = new Date().toISOString();

        await db.update(schema.articles).set({
          title: body.title,
          slug: body.slug,
          excerpt: body.excerpt || null,
          content: body.content || '',
          image: body.image || null,
          category: body.category || null,
          tags: body.tags || '',
          metaTitle: body.metaTitle || null,
          metaDescription: body.metaDescription || null,
          metaKeywords: body.metaKeywords || null,
          author: body.author || 'Admin',
          type: body.type || 'post',
          status: body.status || 'draft',
          date: body.date || now.split('T')[0],
          publishedAt: body.publishedAt || null,
          updatedAt: now,
        }).where(eq(schema.articles.id, id));

        await broadcast(env, { type: 'ARTICLE_UPDATED', id });
        return json({ message: 'Article updated' });
      }

      // DELETE /articles/:id — Delete article
      if (articleIdMatch && method === 'DELETE') {
        const id = parseInt(articleIdMatch[1], 10);
        await db.delete(schema.articles).where(eq(schema.articles.id, id));
        await broadcast(env, { type: 'ARTICLE_DELETED', id });
        return json({ message: 'Article deleted' });
      }

      // =============================================
      // CATEGORIES API
      // =============================================

      // GET /categories — List all categories
      if (normalizedPath === '/categories' && method === 'GET') {
        const results = await db.query.categories.findMany({
          orderBy: [asc(schema.categories.name)],
        });
        return json(results);
      }

      // POST /categories — Create category
      if (normalizedPath === '/categories' && method === 'POST') {
        const body = await request.json() as any;
        const now = new Date().toISOString();

        try {
          await db.insert(schema.categories).values({
            name: body.name,
            slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
            createdAt: now,
            updatedAt: now,
          });

          await broadcast(env, { type: 'CATEGORY_CREATED', name: body.name });
          return json({ message: 'Category created' }, 201);
        } catch (e: any) {
          if (e.message?.includes('UNIQUE')) {
            return json({ message: 'Category already exists' });
          }
          throw e;
        }
      }

      // PUT /categories/by-name/:name — Update category by name
      const categoryByNameMatch = normalizedPath.match(/^\/categories\/by-name\/(.+)$/);
      if (categoryByNameMatch && method === 'PUT') {
        const oldName = decodeURIComponent(categoryByNameMatch[1]);
        const body = await request.json() as any;
        const now = new Date().toISOString();

        await db.update(schema.categories)
          .set({ name: body.newName, updatedAt: now })
          .where(eq(schema.categories.name, oldName));

        // Also update articles that reference this category
        await db.update(schema.articles)
          .set({ category: body.newName })
          .where(eq(schema.articles.category, oldName));

        await broadcast(env, { type: 'CATEGORY_UPDATED', oldName, newName: body.newName });
        return json({ message: 'Category updated' });
      }

      // DELETE /categories/by-name/:name — Delete category by name
      if (categoryByNameMatch && method === 'DELETE') {
        const name = decodeURIComponent(categoryByNameMatch[1]);
        await db.delete(schema.categories).where(eq(schema.categories.name, name));
        await broadcast(env, { type: 'CATEGORY_DELETED', name });
        return json({ message: 'Category deleted' });
      }

      // POST /categories/reset — Reset to default categories
      if (normalizedPath === '/categories/reset' && method === 'POST') {
        await db.delete(schema.categories);

        const defaults = [
          'วิธีเล่นเบื้องต้น', 'เทคนิคการเดินเงิน', 'การอ่านเค้าไพ่',
          'ทริคระดับเซียน', 'เทคนิคบาคาร่า', 'สูตรบาคาร่าฟรี',
          'วิธีเล่น', 'เทคนิคการเดิมพัน'
        ];

        const now = new Date().toISOString();
        
        await db.insert(schema.categories).values(
          defaults.map(name => ({
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            createdAt: now,
            updatedAt: now,
          }))
        );

        return json({ message: 'Categories reset' });
      }

      // POST /categories/clean-duplicates — Remove duplicate categories
      if (normalizedPath === '/categories/clean-duplicates' && method === 'POST') {
        await env.DB.prepare(`
          DELETE FROM categories
          WHERE id NOT IN (
            SELECT MIN(id) FROM categories GROUP BY name
          )
        `).run();

        return json({ message: 'Duplicates cleaned' });
      }

      // =============================================
      // AUTH API
      // =============================================

      // POST /auth/login
      if (normalizedPath === '/auth/login' && method === 'POST') {
        const body = await request.json() as any;

        const user = await db.query.users.findFirst({
          where: (users, { eq, and }) => and(
            eq(users.email, body.email),
            eq(users.password, body.password)
          ),
        });

        if (!user) return error('Invalid credentials', 401);

        const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role }));
        return json({ token, user: { id: user.id, email: user.email, role: user.role } });
      }

      // GET /auth/me
      if (normalizedPath === '/auth/me' && method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return error('Unauthorized', 401);

        try {
          const token = authHeader.replace('Bearer ', '');
          const payload = JSON.parse(atob(token));
          return json(payload);
        } catch {
          return error('Invalid token', 401);
        }
      }

      // =============================================
      // 404
      // =============================================
      return error('Not found', 404);

    } catch (e: any) {
      console.error('Worker error:', e);
      return error(e.message || 'Internal server error', 500);
    }
  },

  async email(message: any, env: Env, ctx: any) {
    // Forward the incoming email to a destination address
    await message.forward("destination@example.com");
    // Or send a new email using the send_email binding
    await env.SEND_EMAIL.send({
      from: message.to,
      to: "recipient@example.com",
      subject: "New email received",
      text: `New email from ${message.from}`,
    });
  },

  async queue(batch: any, env: Env, ctx: any) {
    for (const message of batch.messages) {
      console.log(`Received message from queue:`, message.body);
      // Process your queue messages here
    }
  }
};
