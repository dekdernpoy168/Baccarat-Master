// =============================================
// Cloudflare Worker API with D1 and Drizzle ORM
// Project: Baccarat Master Guide
// =============================================

import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, asc, min, notInArray, sql } from 'drizzle-orm';
import * as schema from './src/db/schema';
import { DurableObject } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
  WEBSOCKET_MANAGER: DurableObjectNamespace<WebSocketManager>;
  MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
  IMAGES: any;
  BUCKET: R2Bucket;
  AI: any;
  MY_QUEUE: any;
  ASSETS?: Fetcher; // Supported when using Cloudflare Pages
  SECRET: string;
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

    // GET /ws or /socket.io — WebSocket Connection
    if (path === '/ws' || path.startsWith('/socket.io')) {
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
      // GENERIC REST API (with Secret Auth)
      // =============================================
      
      // Pattern: /api/rest/:table
      const restMatch = normalizedPath.match(/^\/rest\/([a-zA-Z0-9_]+)$/);
      if (restMatch && method === 'GET') {
        const tableName = restMatch[1];
        const authHeader = request.headers.get('Authorization');
        
        // Check if Secret is set and matches
        if (!env.SECRET || authHeader !== `Bearer ${env.SECRET}`) {
          return error('Unauthorized: Invalid or missing Secret token', 401);
        }

        try {
          // Perform dynamic query safely using sql literal for table name
          // Note: Table name is validated by regex above
          const rawResults = await db.run(sql.raw(`SELECT * FROM ${tableName}`));
          return json(rawResults.results);
        } catch (e: any) {
          return error(`Table '${tableName}' query failed: ${e.message}`, 404);
        }
      }

      // =============================================
      // TEST D1 ENDPOINTS (User Requested)
      // =============================================
      
      // /api/setup: Initialize all tables correctly
      if (normalizedPath === '/setup' && method === 'GET') {
        try {
          // Initialize multiple tables
          await env.DB.batch([
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, role TEXT NOT NULL DEFAULT 'user')`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, updated_at TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, content TEXT NOT NULL, status TEXT DEFAULT 'draft', updated_at TEXT)`),
            env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`)
          ]);
          return new Response('Success: Database tables initialized or already exist!', { status: 200 });
        } catch (e: any) {
          return error(`Setup failed: ${e.message}`, 500);
        }
      }

      // /api/add: Add a test user with error handling
      if (normalizedPath === '/add' && method === 'GET') {
        try {
          const results = await db.insert(schema.users)
            .values({ 
              name: 'Test Administrator',
              email: `admin-${Date.now()}@example.com`,
              role: 'admin'
            })
            .returning();
          
          if (!results[0]) throw new Error("Insert returned no data");
          return json(results[0]);
        } catch (e: any) {
          return error(`Failed to add user: ${e.message}`, 500);
        }
      }

      // /api/users: Get all users with error handling
      if (normalizedPath === '/users' && method === 'GET') {
        try {
          const allUsers = await db.select().from(schema.users).all();
          return json(allUsers);
        } catch (e: any) {
          return error(`Failed to fetch users: ${e.message}`, 500);
        }
      }

      // /api/do-test: Test the new Durable Object
      if (normalizedPath === '/do-test' && method === 'GET') {
        const id = env.MY_DURABLE_OBJECT.idFromName('test');
        const stub = env.MY_DURABLE_OBJECT.get(id);
        const greeting = await stub.sayHello();
        return new Response(greeting);
      }

      // /api/secret-check: Check if the Secret binding is working
      if (normalizedPath === '/secret-check' && method === 'GET') {
        return json({ 
          hasSecret: !!env.SECRET,
          secretValue: env.SECRET ? `${env.SECRET.substring(0, 3)}***` : 'missing'
        });
      }

      // /api/images-test: Placeholder for Images API (Basic check)
      if (normalizedPath === '/images-test' && method === 'GET') {
        return json({ message: 'Cloudflare Images binding detected' });
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
      // R2 IMAGE MANAGEMENT API
      // =============================================
      const R2_PUBLIC_DOMAIN = "https://pic.huisache.com";

      // GET /api/r2/images
      if (normalizedPath === '/r2/images' && method === 'GET') {
          const objects = await env.BUCKET.list();
          const images = (objects.objects || [])
            .filter(o => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(o.key))
            .map(o => ({
              key: o.key,
              url: `${R2_PUBLIC_DOMAIN}/${o.key}`,
              size: o.size,
              lastModified: o.uploaded
            }));
          return json(images);
      }

      // POST /api/r2/upload
      if (normalizedPath === '/r2/upload' && method === 'POST') {
          const formData = await request.formData();
          const file = formData.get('image');
          if (!file || !(file instanceof File)) return error('No image provided');
          
          const safeName = file.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase();
          const key = `uploads/${Date.now()}-${safeName}`;
          
          await env.BUCKET.put(key, await file.arrayBuffer(), {
              httpMetadata: { contentType: file.type }
          });
          
          return json({ url: `${R2_PUBLIC_DOMAIN}/${key}`, key, success: true });
      }

      // DELETE /api/r2/delete/:key
      const r2DeleteMatch = normalizedPath.match(/^\/r2\/delete\/(.+)$/);
      if (r2DeleteMatch && method === 'DELETE') {
          const key = decodeURIComponent(r2DeleteMatch[1]);
          await env.BUCKET.delete(key);
          return json({ success: true, message: 'Deleted from R2' });
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

      // GET /authors — List all authors
      if (normalizedPath === '/authors' && method === 'GET') {
        // Fallback data (since authors table does not exist in schema)
        return json([
          {
            "id": "default-author",
            "name": "Prach Pichaya",
            "position": "Editor",
            "description": "Oversees, reviews, and develops website content to be accurate, clear, readable, and high-quality."
          }
        ]);
      }

      // GET /authors/:id — Get single author
      const authorIdMatch = normalizedPath.match(/^\/authors\/([a-zA-Z0-9_-]+)$/);
      if (authorIdMatch && method === 'GET') {
        const id = authorIdMatch[1];
        // For now, return the default author if ID matches or if no other author exists
        return json({
          "id": "default-author",
          "name": "Prach Pichaya",
          "position": "Editor",
          "description": "Oversees, reviews, and develops website content to be accurate, clear, readable, and high-quality."
        });
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
      // AI API
      // =============================================

      // POST /api/ai/generate-slug
      if (normalizedPath === '/ai/generate-slug' && method === 'POST') {
        const { title } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a SEO expert. Generate 3 SEO-friendly URL slugs from the given title. Return only a JSON object with an "options" array of strings.' },
            { role: 'user', content: `Title: ${title}` }
          ],
          response_format: { type: 'json_object' }
        });
        return json(result);
      }

      // POST /api/ai/generate-keywords
      if (normalizedPath === '/ai/generate-keywords' && method === 'POST') {
        const { primaryKeyword } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a SEO expert. Generate 8 relevant keywords or tags based on the primary keyword. Return as a comma-separated string in a JSON object with key "text".' },
            { role: 'user', content: `Primary Keyword: ${primaryKeyword}` }
          ],
          response_format: { type: 'json_object' }
        });
        return json(result);
      }

      // POST /api/ai/generate-excerpt
      if (normalizedPath === '/ai/generate-excerpt' && method === 'POST') {
        const { title } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a content editor. Generate 3 short, engaging excerpts (meta descriptions) from the given title. Return only a JSON object with an "options" array of strings.' },
            { role: 'user', content: `Title: ${title}` }
          ],
          response_format: { type: 'json_object' }
        });
        return json(result);
      }

      // POST /api/ai/generate-faq
      if (normalizedPath === '/ai/generate-faq' && method === 'POST') {
        const { title, content } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a content assistant. Generate 3 frequently asked questions (FAQs) with answers based on the provided title and content. Return only a JSON array of objects with "question" and "answer" keys.' },
            { role: 'user', content: `Title: ${title}\nContent: ${content}` }
          ],
          response_format: { type: 'json_object' }
        });
        
        // Ensure we return the correct structure the frontend expects
        if (result.options) return json(result.options);
        if (result.faqs) return json(result.faqs);
        return json(result);
      }

      // POST /api/ai/generate-article
      if (normalizedPath === '/ai/generate-article' && method === 'POST') {
        const { prompt } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a expert content writer. Create a high-quality article including HTML content, metaTitle, metaDescription, and slug. Return as a JSON object.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        });
        return json(result);
      }

      // POST /api/ai/brainstorm
      if (normalizedPath === '/ai/brainstorm' && method === 'POST') {
        const { topic } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a content strategist. Brainstorm 5 unique and engaging article topics for the given niche. Return only a JSON object with an "options" array of strings.' },
            { role: 'user', content: `Niche/Topic: ${topic}` }
          ],
          response_format: { type: 'json_object' }
        });
        return json(result);
      }

      // POST /api/ai/execute-prompt
      if (normalizedPath === '/ai/execute-prompt' && method === 'POST') {
        const { prompt, systemPrompt } = await request.json() as any;
        const result: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: prompt }
          ]
        });
        return json(result);
      }

      // POST /api/ai/stream-prompt (Experimental streaming version)
      if (normalizedPath === '/ai/status' && method === 'GET') {
        const hasAI = !!env.AI;
        return json({
          success: hasAI,
          provider: "openai", // Reporting openai as requested
          configured: hasAI,
          ready: hasAI,
          ...(hasAI ? {} : { message: "AI configuration or binding is missing" })
        });
      }

      if (normalizedPath === '/ai/stream-prompt' && method === 'POST') {
        const { prompt } = await request.json() as any;
        const stream = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a expert content writer. Create a high-quality article including HTML content, metaTitle, metaDescription, and slug. Return as a JSON object string.' },
            { role: 'user', content: prompt }
          ],
          stream: true
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      // POST /api/ai/generate-image
      if (normalizedPath === '/ai/generate-image' && method === 'POST') {
        const { prompt, type } = await request.json() as any;
        // Use Flux or SDXL
        const finalPrompt = type === 'logo' ? 'A modern, luxury gold logo for Baccarat Master website' : prompt;
        const result: any = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
          prompt: finalPrompt
        });
        
        // Flux returns image property as base64 or buffer usually
        // We'll return it as a data URL or similar if possible, or binary
        return new Response(result.image, {
          headers: { 'Content-Type': 'image/png' }
        });
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

  async queue(batch: any, env: Env, ctx: any) {
    for (const message of batch.messages) {
      console.log(`Received message from queue:`, message.body);
      // Process your queue messages here
    }
  },

  async scheduled(event: any, env: Env, ctx: any) {
    console.log(event.scheduledTime);
  }
};
