import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { Database } from "@sqlitecloud/drivers";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

async function startServer() {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ["polling"], // Force polling to avoid WebSocket errors and unhandled rejections in this environment
    pingTimeout: 120000,
    pingInterval: 30000,
    allowEIO3: true,
    connectTimeout: 60000,
    maxHttpBufferSize: 1e8 // 100MB
  });

  server.use(express.json({ limit: '50mb' }));
  
  // Request logging middleware
  server.use((req, res, next) => {
    if (!req.url.startsWith('/socket.io')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  const PORT = 3000;

  const connectionString = "sqlitecloud://cjr9vthpvk.g4.sqlite.cloud:8860/bgm-database?apikey=y5jXshHEP9qJ5TSOM2ehp9XYB6idcYAnw9XnPliYYII";
  console.log("Using SQLiteCloud connection string:", connectionString);
  const encryptionKey = process.env.SQLITE_CLOUD_ENCRYPTION_KEY || ""; // Temporarily empty to test
  
  const sqliteDb = new Database(connectionString);
  
  // Apply encryption key if provided
  if (encryptionKey) {
    try {
      console.log("Attempting to apply encryption key...");
      await sqliteDb.sql("PRAGMA key = '" + encryptionKey + "';");
      console.log("SQLiteCloud encryption key applied.");
    } catch (err) {
      console.error("Error applying encryption key:", err);
    }
  }

  // Socket.io connection
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", (reason) => {
      console.log("Client disconnected:", socket.id, "Reason:", reason);
    });
  });

  io.engine.on("connection_error", (err) => {
    console.error("Socket.io server connection error:", err.req ? err.req.url : "no req", err.code, err.message, err.context);
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
    await sqliteDb.sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        createdAt TEXT
      );
    `;
    console.log("SQLiteCloud tables initialized successfully.");

    // Seed default articles if table is empty
    const articlesCount = await sqliteDb.sql`SELECT COUNT(*) as count FROM articles;`;
    if (articlesCount[0].count === 0) {
      console.log("Seeding default articles...");
      const now = new Date().toISOString();
      const defaultArticles = [
        {
          id: 'baccarat-basics',
          title: 'พื้นฐานการเล่นบาคาร่าสำหรับมือใหม่',
          excerpt: 'เรียนรู้วิธีการเล่นบาคาร่าเบื้องต้น กฎกติกา และวิธีการวางเดิมพันที่ถูกต้อง',
          content: '<h2>พื้นฐานการเล่นบาคาร่า</h2><p>บาคาร่าเป็นเกมไพ่ที่ได้รับความนิยมอย่างมากในคาสิโนทั่วโลก...</p>',
          category: 'วิธีเล่นเบื้องต้น',
          author: 'Admin',
          image: 'https://picsum.photos/seed/baccarat1/800/600',
          slug: 'baccarat-basics-for-beginners',
          status: 'published',
          publishedAt: now
        },
        {
          id: 'money-management',
          title: 'เทคนิคการเดินเงินบาคาร่าที่แม่นยำที่สุด',
          excerpt: 'รวมสูตรการเดินเงินบาคาร่าที่ช่วยให้คุณบริหารทุนได้อย่างมีประสิทธิภาพ',
          content: '<h2>เทคนิคการเดินเงิน</h2><p>การบริหารเงินทุนเป็นหัวใจสำคัญของการเล่นบาคาร่า...</p>',
          category: 'เทคนิคการเดินเงิน',
          author: 'Admin',
          image: 'https://picsum.photos/seed/baccarat2/800/600',
          slug: 'best-baccarat-money-management',
          status: 'published',
          publishedAt: now
        }
      ];

      for (const article of defaultArticles) {
        await sqliteDb.sql`
          INSERT INTO articles (
            id, title, excerpt, content, category, author, image, slug, 
            publishedAt, createdAt, updatedAt, status
          ) VALUES (
            ${article.id}, ${article.title}, ${article.excerpt}, ${article.content}, 
            ${article.category}, ${article.author}, ${article.image}, ${article.slug}, 
            ${article.publishedAt}, ${now}, ${now}, ${article.status}
          );
        `;
      }
      console.log("Default articles seeded.");
    }
  } catch (error) {
    console.error("Error initializing SQLiteCloud tables:", error);
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
      broadcastArticlesUpdate();
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
      broadcastArticlesUpdate();
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
      broadcastArticlesUpdate();
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
      const name = cat.name || '';
      
      // Check if category already exists
      const existing = await sqliteDb.sql`SELECT * FROM categories WHERE name = ${name} LIMIT 1;`;
      if (existing && existing.length > 0) {
        return res.json(existing[0]);
      }

      const id = cat.id || Math.random().toString(36).substring(2, 15);
      const now = new Date().toISOString();
      const slug = cat.slug || name.toLowerCase().replace(/\s+/g, '-');
      
      await sqliteDb.sql`
        INSERT INTO categories (id, name, slug, description, createdAt)
        VALUES (${id}, ${name}, ${slug}, ${cat.description || ''}, ${now});
      `;
      broadcastCategoriesUpdate();
      res.json({ id, name, slug, description: cat.description || '', createdAt: now });
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await sqliteDb.sql`DELETE FROM categories WHERE id = ${id};`;
      broadcastCategoriesUpdate();
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
      broadcastCategoriesUpdate();
      broadcastArticlesUpdate();
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
      broadcastCategoriesUpdate();
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

      broadcastCategoriesUpdate();
      res.json({ success: true, message: "Categories reset and seeded successfully." });
    } catch (error: any) {
      console.error("Error resetting categories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clean duplicate categories
  server.post("/api/categories/clean-duplicates", async (req, res) => {
    try {
      // Find duplicates keeping the first one (by createdAt or id)
      await sqliteDb.sql`
        DELETE FROM categories 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM categories 
          GROUP BY name
        );
      `;
      broadcastCategoriesUpdate();
      res.json({ success: true, message: "Duplicate categories cleaned successfully." });
    } catch (error: any) {
      console.error("Error cleaning duplicates:", error);
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
      await sqliteDb.sql`INSERT INTO users (id, email, password, createdAt) VALUES (${id}, ${email}, ${hashedPassword}, ${createdAt})`;
      res.status(201).json({ message: "User registered" });
    } catch (err) {
      res.status(400).json({ error: "Registration failed" });
    }
  });

  server.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const users = await sqliteDb.sql`SELECT * FROM users WHERE email = ${email}`;
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
        hmr: {
          protocol: 'ws',
          host: 'localhost',
        }
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
