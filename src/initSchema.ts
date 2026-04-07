import { exec, query } from './db';
import bcrypt from 'bcryptjs';

export async function initSchema() {
  // 1. CATEGORIES TABLE
  await exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      slug          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await exec(`CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);`);

  // 2. ARTICLES TABLE
  await exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      title             TEXT NOT NULL,
      slug              TEXT NOT NULL UNIQUE,
      excerpt           TEXT,
      content           TEXT NOT NULL DEFAULT '',
      image             TEXT,
      category          TEXT,
      tags              TEXT NOT NULL DEFAULT '',
      meta_title        TEXT,
      meta_description  TEXT,
      meta_keywords     TEXT,
      author            TEXT NOT NULL DEFAULT 'Admin',
      status            TEXT NOT NULL DEFAULT 'draft',
      date              TEXT NOT NULL DEFAULT (date('now')),
      published_at      TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);`);

  // 3. USERS TABLE
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'user',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

  // 4. SEED DATA: CATEGORIES
  const categories = [
    ['วิธีเล่นเบื้องต้น', 'basic-guide'],
    ['เทคนิคการเดินเงิน', 'money-management'],
    ['การอ่านเค้าไพ่', 'card-pattern-reading'],
    ['ทริคระดับเซียน', 'expert-tricks'],
    ['เทคนิคบาคาร่า', 'baccarat-techniques'],
    ['สูตรบาคาร่าฟรี', 'free-baccarat-formula'],
    ['วิธีเล่น', 'how-to-play'],
    ['เทคนิคการเดิมพัน', 'betting-techniques']
  ];

  for (const [name, slug] of categories) {
    await exec(`INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)`, [name, slug]);
  }

  // 5. SEED DATA: ADMIN USER
  const adminId = 'admin-uid';
  const adminEmail = 'admin';
  const adminPassword = 'Bankk2599++';
  
  const existingAdmin = await query(`SELECT id FROM users WHERE id = ?`, [adminId]);
  if (existingAdmin.length === 0) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await exec(
      `INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)`,
      [adminId, adminEmail, hashedPassword, 'admin']
    );
  }

  // 6. SEED DATA: SAMPLE ARTICLE
  await exec(`
    INSERT OR IGNORE INTO articles (title, slug, excerpt, content, category, image, author, status, published_at)
    VALUES (
      'ยินดีต้อนรับสู่คลังบทความบาคาร่า',
      'welcome-to-baccarat-articles',
      'เริ่มต้นเรียนรู้เทคนิคและสูตรบาคาร่าที่นี่',
      '<h2>ยินดีต้อนรับ</h2><p>นี่คือบทความแรกของคุณ</p>',
      'เทคนิคบาคาร่า',
      'https://picsum.photos/seed/baccarat/800/600',
      'Admin',
      'published',
      datetime('now')
    )
  `);
}
