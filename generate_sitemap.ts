import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Load Firebase config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
} catch (e) {
  console.error('Could not load firebase-applet-config.json', e);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig?.firestoreDatabaseId);

async function generateSitemap() {
  try {
    console.log('Generating sitemap.xml and robots.txt...');
    let articles = [];
    try {
      const articlesRef = collection(db, 'articles');
      const snapshot = await getDocs(articlesRef);
      articles = snapshot.docs.map(doc => doc.data());
    } catch (dbError) {
      console.warn('Warning: Could not fetch articles from Firestore (possibly quota exceeded). Generating basic sitemap.', dbError.message);
    }

    const baseUrl = process.env.VITE_APP_URL || 'https://huisache.com';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Static pages
    const staticPages = ['', '/articles', '/formula', '/about'];
    staticPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += '  </url>\n';
    });

    // Dynamic articles
    const now = new Date();
    articles.forEach(article => {
      let isPublished = true;
      if (article.status === 'draft') {
        isPublished = false;
      } else if (article.publishedAt) {
        const pubDate = new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt);
        isPublished = pubDate <= now;
      }
      
      if (isPublished && article.slug) {
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

    const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin
Sitemap: ${baseUrl}/sitemap.xml`;

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }

    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
    fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);

    console.log('Successfully generated sitemap.xml and robots.txt in public/ directory.');
    process.exit(0);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
}

generateSitemap();
