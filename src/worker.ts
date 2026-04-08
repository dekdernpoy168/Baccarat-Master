// =============================================
// Cloudflare Worker API with D1
// Project: Baccarat Master Guide
// =============================================

export interface Env {
  DB: D1Database;
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

    try {
      // =============================================
      // ARTICLES API
      // =============================================

      // GET /api/articles — List all articles
      if (path === '/api/articles' && method === 'GET') {
        const rows = await env.DB.prepare(`
          SELECT id, title, slug, excerpt, content, image, category, tags,
                 meta_title AS metaTitle, meta_description AS metaDescription,
                 meta_keywords AS metaKeywords, author, status, date,
                 published_at AS publishedAt, created_at AS createdAt,
                 updated_at AS updatedAt
          FROM articles
          ORDER BY created_at DESC
        `).all();

        return json(rows.results);
      }

      // GET /api/articles/:id — Get single article
      if (path.match(/^\/api\/articles\/(\d+)$/) && method === 'GET') {
        const id = path.split('/').pop();
        const row = await env.DB.prepare(`
          SELECT id, title, slug, excerpt, content, image, category, tags,
                 meta_title AS metaTitle, meta_description AS metaDescription,
                 meta_keywords AS metaKeywords, author, status, date,
                 published_at AS publishedAt, created_at AS createdAt,
                 updated_at AS updatedAt
          FROM articles WHERE id = ?
        `).bind(id).first();

        if (!row) return error('Article not found', 404);
        return json(row);
      }

      // POST /api/articles — Create article
      if (path === '/api/articles' && method === 'POST') {
        const body = await request.json() as any;
        const now = new Date().toISOString();

        const result = await env.DB.prepare(`
          INSERT INTO articles (title, slug, excerpt, content, image, category, tags,
                                meta_title, meta_description, meta_keywords, author,
                                status, date, published_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          body.title,
          body.slug,
          body.excerpt || null,
          body.content || '',
          body.image || null,
          body.category || null,
          body.tags || '',
          body.metaTitle || null,
          body.metaDescription || null,
          body.metaKeywords || null,
          body.author || 'Admin',
          body.status || 'draft',
          body.date || new Date().toISOString().split('T')[0],
          body.publishedAt || null,
          now,
          now
        ).run();

        return json({ id: result.meta.last_row_id, message: 'Article created' }, 201);
      }

      // PUT /api/articles/:id — Update article
      if (path.match(/^\/api\/articles\/(\d+)$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json() as any;
        const now = new Date().toISOString();

        await env.DB.prepare(`
          UPDATE articles SET
            title = ?, slug = ?, excerpt = ?, content = ?, image = ?,
            category = ?, tags = ?, meta_title = ?, meta_description = ?,
            meta_keywords = ?, author = ?, status = ?, date = ?,
            published_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(
          body.title,
          body.slug,
          body.excerpt || null,
          body.content || '',
          body.image || null,
          body.category || null,
          body.tags || '',
          body.metaTitle || null,
          body.metaDescription || null,
          body.metaKeywords || null,
          body.author || 'Admin',
          body.status || 'draft',
          body.date || new Date().toISOString().split('T')[0],
          body.publishedAt || null,
          now,
          id
        ).run();

        return json({ message: 'Article updated' });
      }

      // DELETE /api/articles/:id — Delete article
      if (path.match(/^\/api\/articles\/(\d+)$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
        return json({ message: 'Article deleted' });
      }

      // =============================================
      // CATEGORIES API
      // =============================================

      // GET /api/categories — List all categories
      if (path === '/api/categories' && method === 'GET') {
        const rows = await env.DB.prepare(`
          SELECT id, name, slug, created_at AS createdAt, updated_at AS updatedAt
          FROM categories ORDER BY name ASC
        `).all();
        return json(rows.results);
      }

      // POST /api/categories — Create category
      if (path === '/api/categories' && method === 'POST') {
        const body = await request.json() as any;
        const now = new Date().toISOString();

        try {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO categories (name, slug, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `).bind(
            body.name,
            body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
            now,
            now
          ).run();

          return json({ message: 'Category created' }, 201);
        } catch (e: any) {
          if (e.message?.includes('UNIQUE')) {
            return json({ message: 'Category already exists' });
          }
          throw e;
        }
      }

      // PUT /api/categories/by-name/:name — Update category by name
      if (path.match(/^\/api\/categories\/by-name\//) && method === 'PUT') {
        const oldName = decodeURIComponent(path.replace('/api/categories/by-name/', ''));
        const body = await request.json() as any;
        const now = new Date().toISOString();

        await env.DB.prepare(`
          UPDATE categories SET name = ?, updated_at = ? WHERE name = ?
        `).bind(body.newName, now, oldName).run();

        // Also update articles that reference this category
        await env.DB.prepare(`
          UPDATE articles SET category = ? WHERE category = ?
        `).bind(body.newName, oldName).run();

        return json({ message: 'Category updated' });
      }

      // DELETE /api/categories/by-name/:name — Delete category by name
      if (path.match(/^\/api\/categories\/by-name\//) && method === 'DELETE') {
        const name = decodeURIComponent(path.replace('/api/categories/by-name/', ''));
        await env.DB.prepare('DELETE FROM categories WHERE name = ?').bind(name).run();
        return json({ message: 'Category deleted' });
      }

      // POST /api/categories/reset — Reset to default categories
      if (path === '/api/categories/reset' && method === 'POST') {
        await env.DB.prepare('DELETE FROM categories').run();

        const defaults = [
          'วิธีเล่นเบื้องต้น', 'เทคนิคการเดินเงิน', 'การอ่านเค้าไพ่',
          'ทริคระดับเซียน', 'เทคนิคบาคาร่า', 'สูตรบาคาร่าฟรี',
          'วิธีเล่น', 'เทคนิคการเดิมพัน'
        ];

        const stmt = env.DB.prepare(
          'INSERT INTO categories (name, slug) VALUES (?, ?)'
        );

        await env.DB.batch(
          defaults.map(name =>
            stmt.bind(name, name.toLowerCase().replace(/\s+/g, '-'))
          )
        );

        return json({ message: 'Categories reset' });
      }

      // POST /api/categories/clean-duplicates — Remove duplicate categories
      if (path === '/api/categories/clean-duplicates' && method === 'POST') {
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

      // POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await request.json() as any;

        const user = await env.DB.prepare(`
          SELECT id, email, role FROM users WHERE email = ? AND password = ?
        `).bind(body.email, body.password).first();

        if (!user) return error('Invalid credentials', 401);

        // ในโปรดักชันควรใช้ JWT จริง
        const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role }));
        return json({ token, user });
      }

      // GET /api/auth/me
      if (path === '/api/auth/me' && method === 'GET') {
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
