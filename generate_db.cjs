const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'baccarat_database.db');

// Delete existing db if it exists
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

const now = new Date().toISOString();

db.serialize(() => {
    // 1. Create articles table
    db.run(`
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
    `);

    // 2. Create categories table
    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT,
            slug TEXT,
            description TEXT,
            createdAt TEXT
        );
    `);

    // 3. Seed Data: Default Categories
    const categories = [
        ['cat-1', 'คู่มือการเล่นบาคาร่า', 'baccarat-guide', 'รวมคู่มือการเล่นเบื้องต้น', now],
        ['cat-2', 'วิธีเล่นเบื้องต้น', 'basic-how-to-play', 'ขั้นตอนการเล่นสำหรับมือใหม่', now],
        ['cat-3', 'เทคนิคการเดินเงิน', 'money-management', 'สูตรการเดินเงินที่แม่นยำ', now],
        ['cat-4', 'การอ่านเค้าไพ่', 'card-reading', 'เทคนิคการวิเคราะห์เค้าไพ่', now],
        ['cat-5', 'ทริคระดับเซียน', 'pro-tricks', 'เทคนิคขั้นสูงจากผู้เชี่ยวชาญ', now]
    ];

    const stmtCat = db.prepare("INSERT OR IGNORE INTO categories (id, name, slug, description, createdAt) VALUES (?, ?, ?, ?, ?)");
    for (const cat of categories) {
        stmtCat.run(cat);
    }
    stmtCat.finalize();

    // 4. Seed Data: Sample Article
    const article = [
        'baccarat-basics', 
        'พื้นฐานการเล่นบาคาร่าสำหรับมือใหม่', 
        'เรียนรู้วิธีการเล่นบาคาร่าเบื้องต้น กฎกติกา และวิธีการวางเดิมพันที่ถูกต้อง', 
        '<h2>พื้นฐานการเล่นบาคาร่า</h2><p>บาคาร่าเป็นเกมไพ่ที่ได้รับความนิยมอย่างมากในคาสิโนทั่วโลก...</p>', 
        'วิธีเล่นเบื้องต้น', 
        'Admin', 
        'https://picsum.photos/seed/baccarat1/800/600', 
        'baccarat-basics-for-beginners', 
        'published', 
        now, 
        now
    ];

    const stmtArt = db.prepare("INSERT OR IGNORE INTO articles (id, title, excerpt, content, category, author, image, slug, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    stmtArt.run(article);
    stmtArt.finalize();

    console.log("Database file 'baccarat_database.db' created successfully.");
});

db.close();
