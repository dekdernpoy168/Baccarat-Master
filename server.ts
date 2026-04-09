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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { exec, query } from './src/db.js';
import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';
import { initSchema } from './src/initSchema.js';
import usersApi from './src/api/users.js';
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from 'openai';

// Configure R2 Client
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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

// Configure OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
});

async function callAI(prompt: string, options: { json?: boolean, schema?: any } = {}) {
  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const modelParams: any = {
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    
    if (options.json) {
      modelParams.config = {
        responseMimeType: "application/json",
        responseSchema: options.schema
      };
    }

    const result: any = await genAI.models.generateContent(modelParams);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || (options.json ? "{}" : "");
    return options.json ? JSON.parse(text) : text;
  } catch (error: any) {
    console.warn("Gemini Error, falling back to OpenAI:", error.message);
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Gemini failed and OPENAI_API_KEY is not set.");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: options.json ? { type: "json_object" } : { type: "text" },
    });

    const text = response.choices[0].message.content || (options.json ? "{}" : "");
    return options.json ? JSON.parse(text) : text;
  }
}

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

  // AI Proxy Routes
  server.post("/api/ai/generate-keywords", async (req, res) => {
    try {
      const { primaryKeyword, count } = req.body;
      const prompt = `Generate ${count || 10} secondary keywords (คีย์รอง) related to the primary keyword: "${primaryKeyword}". 
      Return ONLY the keywords as a comma-separated list. No other text.`;
      
      const text = await callAI(prompt);
      res.json({ text });
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-slug", async (req, res) => {
    try {
      const { title } = req.body;
      const prompt = `Generate 3 SEO-friendly URL slug options in English for this Thai article title: "${title}". Use only lowercase letters and hyphens.`;
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["options"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("Slug Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-excerpt", async (req, res) => {
    try {
      const { title } = req.body;
      const prompt = `เขียนคำโปรย (Excerpt) สั้นๆ ประมาณ 1-2 ประโยค จำนวน 3 ตัวเลือก สำหรับบทความหัวข้อ: "${title}". เน้นความน่าสนใจและดึงดูดผู้อ่าน.`;
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["options"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("Excerpt Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-article", async (req, res) => {
    try {
      const { prompt: userAiPrompt } = req.body;
      const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการเขียนบทความ SEO และการพนันออนไลน์ (บาคาร่า) ที่มีประสบการณ์จริง เขียนด้วยภาษาที่อ่านง่าย สื่อสารได้ใจความ ไม่ซับซ้อน มีความเป็นมนุษย์ มีมุมมองเฉพาะตัวเหมือนคนเขียนจริงๆ ไม่ใช่หุ่นยนต์`;
      const fullPrompt = `${systemPrompt}\n\nโจทย์/คีย์เวิร์ด: ${userAiPrompt}

ข้อกำหนด:
- เขียนเนื้อหาบทความในรูปแบบ HTML (ใช้ <h2>, <p>, <ul>, <li>, <strong>)
- **ห้ามใส่ลิงก์ (<a>) ในหัวข้อ (<h2>, <h3>) เด็ดขาด** ให้ใส่ลิงก์แทรกในเนื้อหาปกติเท่านั้น
- **ความยาวของเนื้อหาบทความต้องอยู่ระหว่าง 1000 - 1500 คำ** (เน้นเนื้อหาที่เจาะลึกและมีประโยชน์)
- นำคีย์เวิร์ดที่เกี่ยวข้องมาแทรกในเนื้อหาและติดตัวหนา (<strong>) ไว้ด้วย
- เน้นความแม่นยำของข้อมูล
- **Meta Title: ห้ามเกิน 60 ตัวอักษร**
- **Meta Description: ห้ามเกิน 160 ตัวอักษร**
- **URL Slug: ภาษาอังกฤษเท่านั้น ใช้ - แทนช่องว่าง**
- **ที่ท้ายบทความ ต้องมีส่วน Call to Action (CTA) โดยใช้โครงสร้าง HTML นี้เสมอ:**
  <div class="cta-block">
    <h3>สนใจนำเทคนิคนี้ไปใช้จริง?</h3>
    <p>เราขอแนะนำเว็บไซต์ที่ได้มาตรฐานสากล มั่นคง และปลอดภัยที่สุดในขณะนี้</p>
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
      <a href="https://inlnk.co/registerbocker168" class="cta-btn">สมัครสมาชิกตอนนี้</a>
      <a href="https://inlnk.co/registerbocker168" class="cta-btn">ไปที่หน้าเดิมพัน</a>
    </div>
  </div>

สำคัญ: ให้ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างที่กำหนด ห้ามมีข้อความอื่นนอกเหนือจาก JSON:
{
  "content": "เนื้อหาบทความ HTML ความยาว 1000-1500 คำ",
  "metaTitle": "Meta Title สำหรับ SEO",
  "metaDescription": "Meta Description สำหรับ SEO",
  "slug": "URL Slug ภาษาอังกฤษ"
}`;

      const data = await callAI(fullPrompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            metaTitle: { type: Type.STRING },
            metaDescription: { type: Type.STRING },
            slug: { type: Type.STRING }
          },
          required: ["content", "metaTitle", "metaDescription", "slug"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("Article Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/brainstorm", async (req, res) => {
    try {
      const prompt = `คุณคือผู้เชี่ยวชาญด้าน Content Strategy สำหรับเว็บไซต์บาคาร่าและคาสิโนออนไลน์ ช่วยคิดหัวข้อบทความที่น่าสนใจและมีโอกาสติดอันดับ SEO สูงมาให้ 10 หัวข้อ โดยเน้นเทคนิคใหม่ๆ สูตรที่คนสนใจ หรือข่าวสารที่เกี่ยวข้อง
      ตอบกลับมาเป็น JSON เท่านั้นตามโครงสร้างที่กำหนด: { "topics": ["หัวข้อที่ 1", "หัวข้อที่ 2", ...] }`;
      
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["topics"]
        }
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-seo", async (req, res) => {
    try {
      const { keyword, topic } = req.body;
      const prompt = `คุณคือผู้เชี่ยวชาญด้าน SEO เขียน Meta Title และ Meta Description โดยอิงจากคีย์เวิร์ดหลักและหัวข้อที่กำหนดให้
      คีย์เวิร์ดหลัก: ${keyword}
      หัวข้อ: ${topic}
      ข้อกำหนด: Meta Title ห้ามเกิน 60 ตัวอักษร, Meta Description ห้ามเกิน 160 ตัวอักษร`;
      
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            metaTitle: { type: Type.STRING },
            metaDescription: { type: Type.STRING }
          },
          required: ["metaTitle", "metaDescription"]
        }
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/keywords-everywhere", async (req, res) => {
    try {
      const { topic } = req.body;
      const apiKey = process.env.KEYWORDS_EVERYWHERE_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const formData = new URLSearchParams();
      formData.append('dataSource', 'gsc');
      formData.append('country', 'th');
      formData.append('currency', 'THB');
      formData.append('kw[]', topic);

      const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-image", async (req, res) => {
    try {
      const { title, type } = req.body;
      let prompt = "";
      if (type === 'logo') {
        prompt = "A professional and luxurious logo for a website named 'Baccarat Master Guide'. The design should feature a combination of playing cards, a golden crown, and elegant typography. The color palette should be gold, black, and deep red. High-end, minimalist but authoritative. Square aspect ratio.";
      } else {
        prompt = `A high-quality, professional, and visually striking featured image for a blog post titled: "${title}". The theme is online baccarat, luxury casino, gambling strategy, and professional gaming. The style should be realistic but with a cinematic, high-end feel. Use a color palette of gold, black, and deep red. No text in the image. 16:9 aspect ratio.`;
      }

      try {
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
        const result: any = await genAI.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        
        const candidates = result.candidates || [];
        const parts = candidates[0]?.content?.parts || [];
        let base64 = null;
        for (const part of parts) {
          if (part.inlineData) {
            base64 = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
        
        if (base64) {
          return res.json({ image: base64 });
        }
        throw new Error("No image data in Gemini response");
      } catch (geminiError: any) {
        console.warn("Gemini Image Gen Error, falling back to DALL-E:", geminiError.message);
        
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("Gemini failed and OPENAI_API_KEY is not set.");
        }

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: type === 'logo' ? "1024x1024" : "1024x1024", // DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792
          response_format: "b64_json",
        });

        const base64 = `data:image/png;base64,${response.data[0].b64_json}`;
        res.json({ image: base64 });
      }
    } catch (error: any) {
      console.error("Image Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/execute-prompt", async (req, res) => {
    try {
      const { prompt } = req.body;
      const text = await callAI(prompt);
      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Request logging middleware
  server.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
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

  
  server.get("/api/socket-status", (req, res) => {
    const clients = io.sockets.sockets.size;
    res.json({ connectedClients: clients });
  });

  // --- Image Upload (Cloudflare R2) ---
  server.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const file = req.file;
      const fileExtension = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
      const bucketName = process.env.R2_BUCKET_NAME || "baccaratmaster";

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await r2Client.send(command);

      // Return the public URL for the uploaded image
      // If R2_PUBLIC_DEV_URL is set (e.g., https://pub-xxx.r2.dev), use it.
      // Otherwise, fallback to a relative path or a custom domain if configured.
      const publicUrlBase = process.env.R2_PUBLIC_DEV_URL || `https://${bucketName}.r2.dev`;
      const imageUrl = `${publicUrlBase}/${fileName}`;

      res.json({ url: imageUrl, success: true });
    } catch (error: any) {
      console.error("Error uploading image to R2:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
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
        'บาคาร่า',
        'สูตรบาคาร่า',
        'เทคนิคบาคาร่า',
        'ข่าวบาคาร่า',
        'คาสิโนออนไลน์',
        'มือใหม่หัดเล่น',
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
    const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin
Sitemap: ${process.env.VITE_APP_URL || 'https://huisache.com'}/sitemap.xml`;
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
    const indexPath = path.join(distPath, "index.html");
    
    if (fs.existsSync(indexPath)) {
      server.use(express.static(distPath));
      server.get("*", (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      console.error(`Production build not found at ${indexPath}. Please run 'npm run build' first.`);
      server.get("*", (req, res) => {
        res.status(404).send("Production build not found. Please run 'npm run build' first.");
      });
    }
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

