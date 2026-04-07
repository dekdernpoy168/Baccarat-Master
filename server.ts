import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { exec, query } from './src/db.js';
import { initSchema } from './src/initSchema.js';

async function startServer() {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
  });

  server.use(cors());
  server.use(express.json({ limit: '50mb' }));
  
  // Request logging middleware
  server.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  const PORT = Number(process.env.PORT || 3000);

  // Socket.io connection
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", (reason) => {
      console.log("Client disconnected:", socket.id, "Reason:", reason);
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log("Socket.io connection error (Engine):", err.req.url, err.code, err.message, err.context);
  });

  // Helper to broadcast updates
  const broadcastArticlesUpdate = () => {
    console.log("Broadcasting articles_updated event");
    io.emit("articles_updated");
  };
  const broadcastCategoriesUpdate = () => {
    console.log("Broadcasting categories_updated event");
    io.emit("categories_updated");
  };

  // Initialize Cloudflare D1 tables
  try {
    await initSchema();
    console.log("Cloudflare D1 tables initialized successfully.");
  } catch (error) {
    console.error("Error initializing Cloudflare D1 tables:", error);
  }

  // Helper functions
  function slugify(text: string) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function today() {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() + 7);
    return d.toISOString().slice(0, 10);
  }

  function normalizeArticleBody(body: any) {
    return {
      title: String(body.title || '').trim(),
      slug: String(body.slug || '').trim(),
      excerpt: body.excerpt ?? '',
      content: body.content ?? '',
      image: body.image ?? '',
      category: body.category ?? null,
      tags: body.tags ?? '',
      metaTitle: body.metaTitle ?? '',
      metaDescription: body.metaDescription ?? '',
      metaKeywords: body.metaKeywords ?? '',
      author: body.author ?? 'Admin',
      status: body.status === 'published' ? 'published' : 'draft',
      date: body.date ?? today(),
      publishedAt: body.publishedAt ?? null,
    };
  }

  async function getArticleById(id: number) {
    const rows = await query(
      `
      SELECT
        id,
        title,
        slug,
        excerpt,
        content,
        image,
        category,
        tags,
        meta_title AS metaTitle,
        meta_description AS metaDescription,
        meta_keywords AS metaKeywords,
        author,
        status,
        date,
        published_at AS publishedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM articles
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  // API routes
  server.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  server.get("/api/socket-status", (req, res) => {
    const clients = io.sockets.sockets.size;
    res.json({ connectedClients: clients });
  });

  // --- Articles ---
  server.get("/api/articles", async (req, res) => {
    try {
      const rows = await query(
        `
        SELECT
          id,
          title,
          slug,
          excerpt,
          content,
          image,
          category,
          tags,
          meta_title AS metaTitle,
          meta_description AS metaDescription,
          meta_keywords AS metaKeywords,
          author,
          status,
          date,
          published_at AS publishedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM articles
        ORDER BY datetime(created_at) DESC, id DESC
        `
      );
      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: error.message || 'Failed to fetch articles' });
    }
  });

  server.get('/api/articles/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const article = await getArticleById(id);

      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      res.json(article);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch article' });
    }
  });

  server.post("/api/articles", async (req, res) => {
    try {
      const data = normalizeArticleBody(req.body);

      if (!data.title) {
        return res.status(400).json({ error: 'title is required' });
      }

      if (!data.slug) {
        data.slug = slugify(data.title);
      }

      const inserted = await query<{ id: number }>(
        `
        INSERT INTO articles (
          title,
          slug,
          excerpt,
          content,
          image,
          category,
          tags,
          meta_title,
          meta_description,
          meta_keywords,
          author,
          status,
          date,
          published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        `,
        [
          data.title,
          data.slug,
          data.excerpt,
          data.content,
          data.image,
          data.category,
          data.tags,
          data.metaTitle,
          data.metaDescription,
          data.metaKeywords,
          data.author,
          data.status,
          data.date,
          data.publishedAt,
        ]
      );

      const article = await getArticleById(inserted[0].id);
      broadcastArticlesUpdate();
      res.status(201).json(article);
    } catch (error: any) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: error.message || 'Failed to create article' });
    }
  });

  server.put("/api/articles/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = normalizeArticleBody(req.body);

      if (!data.title) {
        return res.status(400).json({ error: 'title is required' });
      }

      if (!data.slug) {
        data.slug = slugify(data.title);
      }

      await exec(
        `
        UPDATE articles
        SET
          title = ?,
          slug = ?,
          excerpt = ?,
          content = ?,
          image = ?,
          category = ?,
          tags = ?,
          meta_title = ?,
          meta_description = ?,
          meta_keywords = ?,
          author = ?,
          status = ?,
          date = ?,
          published_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
        `,
        [
          data.title,
          data.slug,
          data.excerpt,
          data.content,
          data.image,
          data.category,
          data.tags,
          data.metaTitle,
          data.metaDescription,
          data.metaKeywords,
          data.author,
          data.status,
          data.date,
          data.publishedAt,
          id,
        ]
      );

      const article = await getArticleById(id);
      broadcastArticlesUpdate();
      res.json(article);
    } catch (error: any) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: error.message || 'Failed to update article' });
    }
  });

  server.delete("/api/articles/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await exec(`DELETE FROM articles WHERE id = ?`, [id]);
      broadcastArticlesUpdate();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: error.message || 'Failed to delete article' });
    }
  });

  // Reset articles table
  server.post("/api/articles/reset", async (req, res) => {
    try {
      await exec(`DELETE FROM articles;`);
      broadcastArticlesUpdate();
      res.json({ success: true, message: "Articles table reset successfully." });
    } catch (error: any) {
      console.error("Error resetting articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Categories ---
  server.get("/api/categories", async (req, res) => {
    try {
      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        ORDER BY name ASC
        `
      );
      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: error.message || 'Failed to fetch categories' });
    }
  });

  server.post("/api/categories", async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const slug = slugify(name);

      await exec(
        `
        INSERT INTO categories (name, slug)
        VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET
          slug = excluded.slug,
          updated_at = datetime('now')
        `,
        [name, slug]
      );

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        WHERE name = ?
        LIMIT 1
        `,
        [name]
      );

      broadcastCategoriesUpdate();
      res.status(201).json(rows[0]);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: error.message || 'Failed to create category' });
    }
  });

  server.put("/api/categories/by-name/:name", async (req, res) => {
    try {
      const oldName = decodeURIComponent(req.params.name);
      const newName = String(req.body?.newName || '').trim();

      if (!newName) {
        return res.status(400).json({ error: 'newName is required' });
      }

      const slug = slugify(newName);

      await exec(
        `
        UPDATE categories
        SET
          name = ?,
          slug = ?,
          updated_at = datetime('now')
        WHERE name = ?
        `,
        [newName, slug, oldName]
      );

      await exec(
        `
        UPDATE articles
        SET
          category = ?,
          updated_at = datetime('now')
        WHERE category = ?
        `,
        [newName, oldName]
      );

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        WHERE name = ?
        LIMIT 1
        `,
        [newName]
      );

      broadcastCategoriesUpdate();
      broadcastArticlesUpdate();
      res.json(rows[0] || { success: true });
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: error.message || 'Failed to update category' });
    }
  });

  server.delete("/api/categories/by-name/:name", async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);

      await exec(`UPDATE articles SET category = NULL, updated_at = datetime('now') WHERE category = ?`, [name]);
      await exec(`DELETE FROM categories WHERE name = ?`, [name]);

      broadcastCategoriesUpdate();
      broadcastArticlesUpdate();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message || 'Failed to delete category' });
    }
  });

  // Reset and seed categories
  server.post("/api/categories/reset", async (req, res) => {
    try {
      const defaults = [
        { name: 'วิธีเล่นเบื้องต้น', slug: 'basic-guide' },
        { name: 'เทคนิคการเดินเงิน', slug: 'money-management' },
        { name: 'การอ่านเค้าไพ่', slug: 'card-pattern-reading' },
        { name: 'ทริคระดับเซียน', slug: 'expert-tricks' },
        { name: 'เทคนิคบาคาร่า', slug: 'baccarat-techniques' },
        { name: 'สูตรบาคาร่าฟรี', slug: 'free-baccarat-formula' },
        { name: 'วิธีเล่น', slug: 'how-to-play' },
        { name: 'เทคนิคการเดิมพัน', slug: 'betting-techniques' },
      ];

      await exec(`DELETE FROM categories`);

      for (const cat of defaults) {
        await exec(
          `INSERT INTO categories (name, slug) VALUES (?, ?)`,
          [cat.name, cat.slug]
        );
      }

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        ORDER BY name ASC
        `
      );

      broadcastCategoriesUpdate();
      res.json({ success: true, categories: rows });
    } catch (error: any) {
      console.error("Error resetting categories:", error);
      res.status(500).json({ error: error.message || 'Failed to reset categories' });
    }
  });

  // Clean duplicate categories
  server.post("/api/categories/clean-duplicates", async (req, res) => {
    try {
      await exec(`
        DELETE FROM categories
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM categories
          GROUP BY TRIM(LOWER(name))
        )
      `);

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        ORDER BY name ASC
        `
      );

      broadcastCategoriesUpdate();
      res.json({ success: true, categories: rows });
    } catch (error: any) {
      console.error("Error cleaning duplicates:", error);
      res.status(500).json({ error: error.message || 'Failed to clean duplicate categories' });
    }
  });

  // Sitemap route
  server.get("/sitemap.xml", async (req, res) => {
    try {
      const articles = await query(`SELECT * FROM articles;`);

      const baseUrl = process.env.VITE_APP_URL || "https://huisache.com";
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Static pages
      const staticPages = ["", "/articles", "/formula", "/about"];
      staticPages.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}${page}</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += `    <priority>${page === "" ? "1.0" : "0.8"}</priority>\n`;
        xml += '  </url>\n';
      });

      // Dynamic articles
      const now = new Date();
      articles.forEach((article: any) => {
        let isPublished = true;
        if (article.status === 'draft') {
          isPublished = false;
        } else if (article.published_at) {
          const pubDate = new Date(article.published_at);
          isPublished = pubDate <= now;
        }
        
        if (isPublished && article.slug) {
          const updatedAt = article.updated_at ? new Date(article.updated_at) : new Date();
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/articles/${article.slug}</loc>\n`;
          xml += `    <lastmod>${updatedAt.toISOString()}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.7</priority>\n';
          xml += '  </url>\n';
        }
      });

      xml += '</urlset>';

      res.header("Content-Type", "application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Error generating sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Robots.txt route
  server.get("/robots.txt", (req, res) => {
    const baseUrl = process.env.VITE_APP_URL || "https://huisache.com";
    const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin
Sitemap: ${baseUrl}/sitemap.xml`;
    res.header("Content-Type", "text/plain");
    res.send(robots);
  });

  // Catch-all for API routes that don't exist
  server.all("/api/*", (req, res) => {
    console.log(`[${new Date().toISOString()}] Unmatched API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Auth API routes
  server.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    try {
      await exec(`INSERT INTO users (id, email, password, created_at) VALUES (?, ?, ?, ?)`, [id, email, hashedPassword, createdAt]);
      res.status(201).json({ message: "User registered" });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(400).json({ error: "Registration failed" });
    }
  });

  server.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const users = await query(`SELECT * FROM users WHERE email = ?`, [email]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, "secret", { expiresIn: "1h" });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  server.get("/api/auth/me", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const user = jwt.verify(token, "secret");
      res.json(user);
    } catch (err) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
    });
    server.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    server.use(express.static(distPath));
    server.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

