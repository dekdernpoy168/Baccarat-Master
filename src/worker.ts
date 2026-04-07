// =============================================
// Cloudflare Worker API with D1
// Baccarat Master Guide
// =============================================

export interface Env {
  DB: D1Database;
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

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

// --- Main Handler ---
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
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

    try {
      // ==========================================
      // ARTICLES
      // ==========================================

      // GET /api/articles
      if (path === '/api/articles' && method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT id, title, slug, excerpt, content, image, category, tags,
                 meta_title AS metaTitle,
                 meta_description AS metaDescription,
                 meta_keywords AS metaKeywords,
                 author, status, date,
                 published_at AS publishedAt,
                 created_at AS createdAt,
                 updated_at AS updatedAt
          FROM articles
          ORDER BY created_at DESC
        `).all();
        return json(results);
      }

      // GET /api/articles/:id
      if (path.match(/^\/api\/articles\/\d+$/) && method === 'GET') {
        const id = path.split('/').pop();
        const row = await env.DB.prepare(`
          SELECT id, title, slug, excerpt, content, image, category, tags,
                 meta_title AS metaTitle,
                 meta_description AS metaDescription,
                 meta_keywords AS metaKeywords,
                 author, status, date,
                 published_at AS publishedAt,
                 created_at AS createdAt,
                 updated_at AS updatedAt
          FROM articles WHERE id = ?
        `).bind(id).first();
        if (!row) return error('Article not found', 404);
        return json(row);
      }

      // POST /api/articles
      if (path === '/api/articles' && method === 'POST') {
        const body: any = await request.json();
        const now = new Date().toISOString();
        const result = await env.DB.prepare(`
          INSERT INTO articles
            (title, slug, excerpt, content, image, category, tags,
             meta_title, meta_description, meta_keywords,
             author, status, date, published_at, created_at, updated_at)
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
          now, now
        ).run();
        return json({ id: result.meta.last_row_id, message: 'Created' }, 201);
      }

      // PUT /api/articles/:id
      if (path.match(/^\/api\/articles\/\d+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body: any = await request.json();
        const now = new Date().toISOString();
        await env.DB.prepare(`
          UPDATE articles SET
            title=?, slug=?, excerpt=?, content=?, image=?,
            category=?, tags=?, meta_title=?, meta_description=?,
            meta_keywords=?, author=?, status=?, date=?,
            published_at=?, updated_at=?
          WHERE id=?
        `).bind(
          body.title, body.slug, body.excerpt || null,
          body.content || '', body.image || null,
          body.category || null, body.tags || '',
          body.metaTitle || null, body.metaDescription || null,
          body.metaKeywords || null, body.author || 'Admin',
          body.status || 'draft',
          body.date || new Date().toISOString().split('T')[0],
          body.publishedAt || null, now, id
        ).run();
        return json({ message: 'Updated' });
      }

      // DELETE /api/articles/:id
      if (path.match(/^\/api\/articles\/\d+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        await env.DB.prepare('DELETE FROM articles WHERE id=?').bind(id).run();
        return json({ message: 'Deleted' });
      }

      // ==========================================
      // CATEGORIES
      // ==========================================

      // GET /api/categories
      if (path === '/api/categories' && method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT id, name, slug,
                 created_at AS createdAt,
                 updated_at AS updatedAt
          FROM categories ORDER BY name ASC
        `).all();
        return json(results);
      }

      // POST /api/categories
      if (path === '/api/categories' && method === 'POST') {
        const body: any = await request.json();
        const now = new Date().toISOString();
        try {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO categories (name, slug, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `).bind(
            body.name,
            body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
            now, now
          ).run();
          return json({ message: 'Created' }, 201);
        } catch (e: any) {
          if (e.message?.includes('UNIQUE')) return json({ message: 'Already exists' });
          throw e;
        }
      }

      // PUT /api/categories/by-name/:name
      if (path.startsWith('/api/categories/by-name/') && method === 'PUT') {
        const oldName = decodeURIComponent(path.replace('/api/categories/by-name/', ''));
        const body: any = await request.json();
        const now = new Date().toISOString();

        // อัพเดตชื่อหมวดหมู่
        await env.DB.prepare('UPDATE categories SET name=?, updated_at=? WHERE name=?')
          .bind(body.newName, now, oldName).run();

        // อัพเดตบทความที่ใช้หมวดหมู่นี้ด้วย
        await env.DB.prepare('UPDATE articles SET category=? WHERE category=?')
          .bind(body.newName, oldName).run();

        return json({ message: 'Updated' });
      }

      // DELETE /api/categories/by-name/:name
      if (path.startsWith('/api/categories/by-name/') && method === 'DELETE') {
        const name = decodeURIComponent(path.replace('/api/categories/by-name/', ''));
        await env.DB.prepare('DELETE FROM categories WHERE name=?').bind(name).run();
        return json({ message: 'Deleted' });
      }

      // POST /api/categories/reset
      if (path === '/api/categories/reset' && method === 'POST') {
        await env.DB.prepare('DELETE FROM categories').run();
        const defaults = [
          ['วิธีเล่นเบื้องต้น', 'basic-guide'],
          ['เทคนิคการเดินเงิน', 'money-management'],
          ['การอ่านเค้าไพ่', 'card-pattern-reading'],
          ['ทริคระดับเซียน', 'expert-tricks'],
          ['เทคนิคบาคาร่า', 'baccarat-techniques'],
          ['สูตรบาคาร่าฟรี', 'free-baccarat-formula'],
          ['วิธีเล่น', 'how-to-play'],
          ['เทคนิคการเดิมพัน', 'betting-techniques'],
        ];
        const stmt = env.DB.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
        await env.DB.batch(defaults.map(([n, s]) => stmt.bind(n, s)));
        return json({ message: 'Reset done' });
      }

      // POST /api/categories/clean-duplicates
      if (path === '/api/categories/clean-duplicates' && method === 'POST') {
        await env.DB.prepare(`
          DELETE FROM categories WHERE id NOT IN (SELECT MIN(id) FROM categories GROUP BY name)
        `).run();
        return json({ message: 'Cleaned' });
      }

      // ==========================================
      // AUTH
      // ==========================================

      // POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        const body: any = await request.json();
        const user = await env.DB.prepare(
          'SELECT id, email, role FROM users WHERE email=? AND password=?'
        ).bind(body.email, body.password).first();

        if (!user) return error('Invalid credentials', 401);

        const token = btoa(JSON.stringify(user));
        return json({ token, user });
      }

      // GET /api/auth/me
      if (path === '/api/auth/me' && method === 'GET') {
        const auth = request.headers.get('Authorization');
        if (!auth?.startsWith('Bearer ')) return error('Unauthorized', 401);
        try {
          return json(JSON.parse(atob(auth.replace('Bearer ', ''))));
        } catch {
          return error('Invalid token', 401);
        }
      }

      // ==========================================
      // 404
      // ==========================================
      return error('Not found', 404);

    } catch (e: any) {
      console.error('Worker error:', e);
      return error(e.message || 'Internal server error', 500);
    }
  },
};
