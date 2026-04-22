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
import multer from "multer";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { exec, query } from './src/db.js';
import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';
import { initSchema } from './src/initSchema.js';
import usersApi from './src/api/users.js';
import { aiService } from './src/services/aiService.js';
import { z } from "zod";

// Database-backed API configuration
let aiConfigCache: any = null;
let lastCacheTime = 0;

// Configure R2 Client
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

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
  server.use('/api/users', usersApi);

  // Request logging middleware
  server.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // AI Proxy Routes
  server.get("/api/ai/status", async (req, res) => {
    try {
      const status = await aiService.getAiStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  server.post("/api/ai/generate-meta-data", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ success: false, message: "Title is required" });
      const result = await aiService.generateMetaData(title);
      res.json(result);
    } catch (error: any) {
      res.status(500).json(error);
    }
  });

  server.post("/api/ai/generate-tags", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ success: false, message: "Title is required" });
      const result = await aiService.generateTags(title);
      res.json(result);
    } catch (error: any) {
      res.status(500).json(error);
    }
  });

  server.post("/api/ai/generate-excerpt", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ success: false, message: "Title is required" });
      const result = await aiService.generateExcerpt(title);
      res.json(result);
    } catch (error: any) {
      res.status(500).json(error);
    }
  });

  server.post("/api/ai/generate-slug", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ success: false, message: "Title is required" });
      const result = await aiService.generateSlug(title);
      res.json(result);
    } catch (error: any) {
      res.status(500).json(error);
    }
  });

  const PORT = Number(process.env.PORT || 3000);

  // Socket.io connection
  io.engine.on("connection_error", (err) => {
    console.log("Connection error:", err.req ? err.req.url : 'unknown', err.code, err.message, err.context);
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    socket.on("get_users", async () => {
      const allUsers = await db.select().from(users);
      socket.emit("users_updated", allUsers);
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });
    socket.on("disconnect", (reason) => {
      console.log("Client disconnected:", socket.id, "Reason:", reason);
    });
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
  const hasCloudflareConfig = process.env.CLOUDFLARE_ACCOUNT_ID && 
                             process.env.CLOUDFLARE_API_TOKEN && 
                             process.env.CLOUDFLARE_D1_DATABASE_ID;

  if (!hasCloudflareConfig) {
    console.error("CRITICAL: Cloudflare D1 configuration is missing! Database operations will fail.");
    console.error("Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID in environment variables.");
  }

  try {
    if (hasCloudflareConfig) {
      await initSchema();
      console.log("Cloudflare D1 tables initialized successfully.");
    }
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
    return new Date().toISOString().slice(0, 10);
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
      faqs: body.faqs ?? '[]',
      author: body.author ?? 'Admin',
      author_id: body.author_id ?? body.authorId ?? null,
      status: body.status === 'published' ? 'published' : 'draft',
      type: body.type === 'page' ? 'page' : 'post',
      date: body.date ?? today(),
      publishedAt: body.publishedAt ?? null,
    };
  }

  async function getArticleById(id: number) {
    const rows = await query(
      `
      SELECT
        a.id,
        a.title,
        a.slug,
        a.excerpt,
        a.content,
        a.image,
        a.category,
        c.slug AS categorySlug,
        a.tags,
        a.meta_title AS metaTitle,
        a.meta_description AS metaDescription,
        a.meta_keywords AS metaKeywords,
        a.faqs,
        a.author,
        a.author_id AS author_id,
        a.status,
        a.type,
        a.date,
        a.published_at AS publishedAt,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt
      FROM articles a
      LEFT JOIN categories c ON a.category = c.name
      WHERE a.id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  
  server.get("/api/socket-status", (req, res) => {
    const clients = io.sockets.sockets.size;
    res.json({ connectedClients: clients });
  });

  // --- Image Management (Cloudflare R2) ---
  const R2_BUCKET = process.env.R2_BUCKET_NAME || "baccarat-master-assets";
  const R2_PUBLIC_DOMAIN = "https://pic.huisache.com";

  // List all images
  server.get("/api/r2/images", async (req, res) => {
    try {
      const command = new ListObjectsV2Command({ 
        Bucket: R2_BUCKET,
        // MaxKeys: 1000 // You can limit if needed
      });
      const response = await r2Client.send(command);
      
      const images = (response.Contents || [])
        .filter(item => item.Key && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.Key))
        .sort((a, b) => ((b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)))
        .map(item => ({
          key: item.Key,
          url: `${R2_PUBLIC_DOMAIN}/${item.Key}`,
          size: item.Size,
          lastModified: item.LastModified
        }));
      
      res.json(images);
    } catch (error: any) {
      console.error("Error listing R2 assets:", error);
      res.status(500).json({ error: error.message || "Failed to list images" });
    }
  });

  // Upload image
  server.post("/api/r2/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const file = req.file;
      const fileExtension = path.extname(file.originalname);
      // Clean and safe filename
      const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '-').toLowerCase();
      const fileName = `uploads/${Date.now()}-${safeName}`;

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype || 'image/jpeg',
      });

      await r2Client.send(command);
      const imageUrl = `${R2_PUBLIC_DOMAIN}/${fileName}`;

      res.json({ url: imageUrl, key: fileName, success: true });
    } catch (error: any) {
      console.error("Error uploading to R2:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // Delete image
  server.delete("/api/r2/delete/:key(*)", async (req, res) => {
    try {
      const key = req.params.key;
      if (!key) {
        return res.status(400).json({ error: "Key is required" });
      }

      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key
      });

      await r2Client.send(command);
      res.json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting from R2:", error);
      res.status(500).json({ error: error.message || "Failed to delete image" });
    }
  });

  // Legacy endpoints for compatibility (optional, but good to keep or redirect)
  server.get("/api/assets", async (req, res) => {
    // Redirect or proxy to new endpoint
    try {
      const command = new ListObjectsV2Command({ Bucket: R2_BUCKET });
      const response = await r2Client.send(command);
      const images = (response.Contents || [])
        .filter(item => item.Key && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.Key))
        .map(item => ({
          key: item.Key,
          url: `${R2_PUBLIC_DOMAIN}/${item.Key}`
        }));
      res.json(images);
    } catch (e) {
      res.json([]);
    }
  });

  server.post("/api/upload", upload.single("image"), async (req, res) => {
    // Proxy to new logic
    try {
      if (!req.file) return res.status(400).json({ error: "No image" });
      const fileName = `legacy/${Date.now()}-${req.file.originalname}`;
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
      res.json({ url: `${R2_PUBLIC_DOMAIN}/${fileName}`, success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Articles ---
  server.get("/api/articles", async (req, res) => {
    try {
      const rows = await query(
        `
        SELECT
          a.id,
          a.title,
          a.slug,
          a.excerpt,
          a.content,
          a.image,
          a.category,
          c.slug AS categorySlug,
          a.tags,
          a.meta_title AS metaTitle,
          a.meta_description AS metaDescription,
          a.meta_keywords AS metaKeywords,
          a.faqs,
          a.author,
          a.author_id AS author_id,
          a.status,
          a.type,
          a.date,
          a.published_at AS publishedAt,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt
        FROM articles a
        LEFT JOIN categories c ON a.category = c.name
        ORDER BY datetime(a.created_at) DESC, a.id DESC
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
          faqs,
          author,
          author_id,
          status,
          type,
          date,
          published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          data.faqs,
          data.author,
          data.author_id,
          data.status,
          data.type,
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
          faqs = ?,
          author = ?,
          author_id = ?,
          status = ?,
          type = ?,
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
          data.faqs,
          data.author,
          data.author_id,
          data.status,
          data.type,
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
        'Method of Play',
        'Free Baccarat Formula',
        'Expert Techniques',
        'Money Management',
        'Popular Roadmaps',
        'Casino Reviews',
        'Industry News',
        'Latest Articles'
      ];

      await exec(`DELETE FROM categories`);

      for (const name of defaults) {
        await exec(
          `INSERT INTO categories (name, slug) VALUES (?, ?)`,
          [name, slugify(name)]
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

  // Authors routes
  server.get("/api/authors", async (req, res) => {
    try {
      let rows: any[] = [];
      try {
        rows = await query(`
          SELECT 
            id, 
            name, 
            description, 
            position, 
            image, 
            created_at AS createdAt, 
            updated_at AS updatedAt 
          FROM authors 
          ORDER BY name ASC
        `);
      } catch (dbErr) {
        console.warn("Authors DB query failed, using mock data:", dbErr);
      }
      
      // Fallback/Mock authors if none found OR DB error happened
      if (!rows || rows.length === 0) {
        rows = [
          {
            "id": "default-author",
            "name": "Prach Pichaya",
            "position": "Editor",
            "description": "Oversees, reviews, and develops website content to be accurate, clear, readable, and high-quality."
          }
        ];
      }
      
      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching authors:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/authors", async (req, res) => {
    try {
      const { name, description, position, avatarUrl } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      await exec(
        `INSERT INTO authors (name, description, position, image) VALUES (?, ?, ?, ?)`,
        [name, description || null, position || null, avatarUrl || null]
      );
      
      const rows = await query(`SELECT id, name, description, position, image, created_at AS createdAt, updated_at AS updatedAt FROM authors ORDER BY id DESC LIMIT 1`);
      res.status(201).json(rows[0]);
    } catch (error: any) {
      console.error("Error creating author:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.put("/api/authors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, position, avatarUrl } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      await exec(
        `UPDATE authors SET name = ?, description = ?, position = ?, image = ?, updated_at = datetime('now') WHERE id = ?`,
        [name, description || null, position || null, avatarUrl || null, id]
      );
      
      const rows = await query(`SELECT id, name, description, position, image, created_at AS createdAt, updated_at AS updatedAt FROM authors WHERE id = ?`, [id]);
      res.json(rows[0]);
    } catch (error: any) {
      console.error("Error updating author:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.delete("/api/authors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await exec(`DELETE FROM authors WHERE id = ?`, [id]);
      res.json({ 
        success: true, 
        message: 'Author deleted',
        id: id
      });
    } catch (error: any) {
      console.error("Error deleting author:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sitemap route
  server.get("/sitemap.xml", async (req, res) => {
    try {
      const articles = await query(`SELECT * FROM articles;`);

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
        } else if (article.published_at) {
          const pubDate = new Date(article.published_at);
          isPublished = pubDate <= now;
        }
        
        if (isPublished && article.slug) {
          const updatedAt = article.updated_at ? new Date(article.updated_at) : new Date();
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/${article.slug}</loc>\n`;
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
      await exec(`INSERT INTO users (id, email, password, createdAt) VALUES (?, ?, ?, ?)`, [id, email, hashedPassword, createdAt]);
      res.status(201).json({ message: "User registered" });
    } catch (err) {
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
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");
  const hasBuild = fs.existsSync(indexPath);

  if (isProduction && hasBuild) {
    console.log("Serving production build from:", distPath);
    server.use(express.static(distPath));
    server.get("*", (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    if (isProduction && !hasBuild) {
      console.warn(`Production build not found at ${indexPath}. Falling back to Vite middleware.`);
    }
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
    });
    server.use(vite.middlewares);
  }

  server.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express error:", err);
    res.status(500).send("Internal Server Error");
  });

  httpServer.on('request', (req, res) => {
    if (req.url?.startsWith('/socket.io')) {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`[RAW] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
      });
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

