// =============================================
// Cloudflare Worker API with D1 and Drizzle ORM
// Project: Baccarat Master Guide
// =============================================

import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, asc, min, notInArray } from 'drizzle-orm';
import * as schema from './src/db/schema';

export interface Env {
  DB: D1Database;
  WEBSOCKET_MANAGER: DurableObjectNamespace;
  ASSETS?: Fetcher; // Supported when using Cloudflare Pages
}

// --- WebSocket Manager (Durable Object) ---
export class WebSocketManager {
  sessions: WebSocket[] = [];

  constructor(state: any, env: Env) {}

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
          const response = await env.ASSETS.fetch(request.clone());
          
          // SPA Fallback: If it's a 404 and not a file (no dot in the last segment), serve index.html
          const url = new URL(request.url);
          const lastSegment = url.pathname.split('/').pop() || '';
          if (response.status === 404 && !lastSegment.includes('.')) {
            return await env.ASSETS.fetch(new URL('/', request.url));
          }
          
          return response;
        } catch (e) {
          console.error("Error fetching from ASSETS:", e);
        }
      }

      // Root path returns status JSON if no assets
      if (normalizedPath === "/") {
        return json({ 
          status: 'ok', 
          message: 'Baccarat Master API is running.',
          endpoints: ['/api/articles', '/api/categories', '/api/auth/me'],
          note: 'Front-end assets (env.ASSETS) not bound.'
        });
      }

      // For other paths, return a specialized error page
      return new Response(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Configuration Required - Baccarat Master</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #141414; padding: 2rem; border-radius: 12px; border: 1px solid #333; max-width: 500px; line-height: 1.6; }
            h1 { color: #f27d26; margin-top: 0; }
            code { background: #000; padding: 2px 6px; border-radius: 4px; color: #0f0; }
            .steps { text-align: left; margin-top: 20px; font-size: 14px; }
            .btn { display: inline-block; background: #f27d26; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>ยังไม่ได้ตั้งค่า Assets</h1>
            <p>หน้าเว็บ React ของคุณยังไม่ได้เชื่อมกับระบบ API (Worker)</p>
            <div class="steps">
              <strong>วิธีแก้ไข:</strong>
              <ol>
                <li>ไปที่หน้า Dashboard ของ Cloudflare</li>
                <li>ไปที่ <b>Workers & Pages</b> > <b>baccaratmaster</b></li>
                <li>ไปที่ <b>Settings (การตั้งค่า)</b> > <b>Variables (ตัวแปร)</b></li>
                <li>ที่ <b>Service Bindings</b> กด <b>Add Binding</b></li>
                <li><b>Variable name:</b> <code>ASSETS</code></li>
                <li><b>Service:</b> เลือกโปรเจกต์ Pages ของคุณ</li>
                <li>กด <b>Save and deploy</b> แล้วรีเฟรชหน้านี้</li>
              </ol>
            </div>
            <a href="https://dash.cloudflare.com" class="btn" target="_blank">ไปที่ Cloudflare Dashboard</a>
          </div>
        </body>
        </html>
      `, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }

    try {
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
};
