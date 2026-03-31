import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

// Load Firebase config
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
} catch (e) {
  console.error("Could not load firebase-applet-config.json", e);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig?.firestoreDatabaseId);

async function startServer() {
  const server = express();
  const PORT = 3000;

  // API routes
  server.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Sitemap route
  server.get("/sitemap.xml", async (req, res) => {
    try {
      const articlesRef = collection(db, "articles");
      const snapshot = await getDocs(articlesRef);
      const articles = snapshot.docs.map(doc => doc.data());

      const baseUrl = "https://baccaratmasterguide.com";
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
      articles.forEach(article => {
        let isPublished = true;
        if (article.publishedAt) {
          const pubDate = new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt);
          isPublished = pubDate <= now;
        }
        
        if (isPublished) {
          const updatedAt = article.updatedAt ? new Date(article.updatedAt.seconds ? article.updatedAt.seconds * 1000 : article.updatedAt) : new Date();
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
Sitemap: https://baccaratmasterguide.com/sitemap.xml`;
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
