-- Baccarat Master Guide Database Schema
-- Supported for SQLite, SQLite3, SQLiteCloud

-- 1. Table: articles
-- Stores all article content, SEO data, and publishing status
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
    status TEXT -- 'published' or 'draft'
);

-- 2. Table: categories
-- Stores article categories
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT,
    slug TEXT,
    description TEXT,
    createdAt TEXT
);

-- 3. Seed Data: Default Categories
INSERT OR IGNORE INTO categories (id, name, slug, description, createdAt) VALUES 
('cat-1', 'คู่มือการเล่นบาคาร่า', 'baccarat-guide', 'รวมคู่มือการเล่นเบื้องต้น', datetime('now')),
('cat-2', 'วิธีเล่นเบื้องต้น', 'basic-how-to-play', 'ขั้นตอนการเล่นสำหรับมือใหม่', datetime('now')),
('cat-3', 'เทคนิคการเดินเงิน', 'money-management', 'สูตรการเดินเงินที่แม่นยำ', datetime('now')),
('cat-4', 'การอ่านเค้าไพ่', 'card-reading', 'เทคนิคการวิเคราะห์เค้าไพ่', datetime('now')),
('cat-5', 'ทริคระดับเซียน', 'pro-tricks', 'เทคนิคขั้นสูงจากผู้เชี่ยวชาญ', datetime('now'));

-- 4. Seed Data: Sample Article
INSERT OR IGNORE INTO articles (id, title, excerpt, content, category, author, image, slug, status, createdAt, updatedAt) VALUES 
('baccarat-basics', 
'พื้นฐานการเล่นบาคาร่าสำหรับมือใหม่', 
'เรียนรู้วิธีการเล่นบาคาร่าเบื้องต้น กฎกติกา และวิธีการวางเดิมพันที่ถูกต้อง', 
'<h2>พื้นฐานการเล่นบาคาร่า</h2><p>บาคาร่าเป็นเกมไพ่ที่ได้รับความนิยมอย่างมากในคาสิโนทั่วโลก...</p>', 
'วิธีเล่นเบื้องต้น', 
'Admin', 
'https://picsum.photos/seed/baccarat1/800/600', 
'baccarat-basics-for-beginners', 
'published', 
datetime('now'), 
datetime('now'));
