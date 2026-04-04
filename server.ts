import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { Database } from "@sqlitecloud/drivers";

async function startServer() {
  const server = express();
  server.use(express.json({ limit: '50mb' }));
  const PORT = 3000;

  const connectionString = process.env.SQLITE_CLOUD_URL || "sqlitecloud://cjr9vthpvk.g4.sqlite.cloud:8860/auth.sqlitecloud?apikey=y5jXshHEP9qJ5TSOM2ehp9XYB6idcYAnw9XnPliYYII";
  const sqliteDb = new Database(connectionString);

  // Initialize SQLiteCloud tables
  try {
    await sqliteDb.sql`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT,
        excerpt TEXT,
        content TEXT,
        category TEXT,
        date TEXT,
        author TEXT,
        image TEXT,
        slug TEXT,
        metaTitle TEXT,
        metaDescription TEXT,
        metaKeywords TEXT,
        publishedAt TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        status TEXT
      );
    `;
    await sqliteDb.sql`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT,
        description TEXT,
        createdAt TEXT
      );
    `;
    console.log("SQLiteCloud tables initialized successfully.");
  } catch (error) {
    console.error("Error initializing SQLiteCloud tables:", error);
  }

  // API routes
  server.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Articles ---
  server.get("/api/articles", async (req, res) => {
    try {
      const articles = await sqliteDb.sql`SELECT * FROM articles ORDER BY createdAt DESC;`;
      res.json(articles);
    } catch (error: any) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/articles", async (req, res) => {
    try {
      const article = req.body;
      const id = article.id || Math.random().toString(36).substring(2, 15);
      const now = new Date().toISOString();
      
      await sqliteDb.sql`
        INSERT INTO articles (
          id, title, excerpt, content, category, date, author, image, slug, 
          metaTitle, metaDescription, metaKeywords, publishedAt, createdAt, updatedAt, status
        ) VALUES (
          ${id}, ${article.title || ''}, ${article.excerpt || ''}, ${article.content || ''}, 
          ${article.category || ''}, ${article.date || ''}, ${article.author || ''}, ${article.image || ''}, 
          ${article.slug || ''}, ${article.metaTitle || ''}, ${article.metaDescription || ''}, 
          ${article.metaKeywords || ''}, ${article.publishedAt || null}, ${now}, ${now}, ${article.status || 'draft'}
        );
      `;
      res.json({ id, ...article, createdAt: now, updatedAt: now });
    } catch (error: any) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.put("/api/articles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const article = req.body;
      const now = new Date().toISOString();
      
      await sqliteDb.sql`
        UPDATE articles SET
          title = ${article.title || ''},
          excerpt = ${article.excerpt || ''},
          content = ${article.content || ''},
          category = ${article.category || ''},
          date = ${article.date || ''},
          author = ${article.author || ''},
          image = ${article.image || ''},
          slug = ${article.slug || ''},
          metaTitle = ${article.metaTitle || ''},
          metaDescription = ${article.metaDescription || ''},
          metaKeywords = ${article.metaKeywords || ''},
          publishedAt = ${article.publishedAt || null},
          updatedAt = ${now},
          status = ${article.status || 'draft'}
        WHERE id = ${id};
      `;
      res.json({ id, ...article, updatedAt: now });
    } catch (error: any) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.delete("/api/articles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await sqliteDb.sql`DELETE FROM articles WHERE id = ${id};`;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset articles table
  server.post("/api/articles/reset", async (req, res) => {
    try {
      await sqliteDb.sql`DELETE FROM articles;`;
      res.json({ success: true, message: "Articles table reset successfully." });
    } catch (error: any) {
      console.error("Error resetting articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Categories ---
  server.get("/api/categories", async (req, res) => {
    try {
      const categories = await sqliteDb.sql`SELECT * FROM categories ORDER BY name ASC;`;
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/categories", async (req, res) => {
    try {
      const cat = req.body;
      const id = cat.id || Math.random().toString(36).substring(2, 15);
      const now = new Date().toISOString();
      
      await sqliteDb.sql`
        INSERT INTO categories (id, name, slug, description, createdAt)
        VALUES (${id}, ${cat.name || ''}, ${cat.slug || ''}, ${cat.description || ''}, ${now});
      `;
      res.json({ id, ...cat, createdAt: now });
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await sqliteDb.sql`DELETE FROM categories WHERE id = ${id};`;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.put("/api/categories/by-name/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const { newName } = req.body;
      await sqliteDb.sql`UPDATE categories SET name = ${newName} WHERE name = ${name};`;
      await sqliteDb.sql`UPDATE articles SET category = ${newName} WHERE category = ${name};`;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.delete("/api/categories/by-name/:name", async (req, res) => {
    try {
      const { name } = req.params;
      await sqliteDb.sql`DELETE FROM categories WHERE name = ${name};`;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset and seed categories
  server.post("/api/categories/reset", async (req, res) => {
    try {
      await sqliteDb.sql`DELETE FROM categories;`;
      
      const defaultCategories = [
        "คู่มือการเล่นบาคาร่า",
        "วิธีเล่นเบื้องต้น",
        "เทคนิคการเดินเงิน",
        "การอ่านเค้าไพ่",
        "ทริคระดับเซียน"
      ];

      for (const name of defaultCategories) {
        const id = Math.random().toString(36).substring(2, 15);
        const now = new Date().toISOString();
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        await sqliteDb.sql`
          INSERT INTO categories (id, name, slug, description, createdAt)
          VALUES (${id}, ${name}, ${slug}, '', ${now});
        `;
      }

      res.json({ success: true, message: "Categories reset and seeded successfully." });
    } catch (error: any) {
      console.error("Error resetting categories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sitemap route
  server.get("/sitemap.xml", async (req, res) => {
    try {
      const articles = await sqliteDb.sql`SELECT * FROM articles;`;

      const baseUrl = "https://huisache.com";
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
        } else if (article.publishedAt) {
          const pubDate = new Date(article.publishedAt);
          isPublished = pubDate <= now;
        }
        
        if (isPublished && article.slug) {
          const updatedAt = article.updatedAt ? new Date(article.updatedAt) : new Date();
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
    const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin
Sitemap: https://huisache.com/sitemap.xml`;
    res.header("Content-Type", "text/plain");
    res.send(robots);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
