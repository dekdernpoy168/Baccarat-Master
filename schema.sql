-- =============================================
-- Cloudflare D1 Database Schema
-- Project: Baccarat Master Guide
-- =============================================

-- =============================================
-- 1. CATEGORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  slug          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- =============================================
-- 2. ARTICLES TABLE
-- =============================================
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
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  date              TEXT NOT NULL DEFAULT (date('now')),
  published_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);

-- =============================================
-- 3. USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================
-- 4. DEFAULT CATEGORIES (Seed Data)
-- =============================================
INSERT OR IGNORE INTO categories (name, slug) VALUES
  ('วิธีเล่นเบื้องต้น', 'basic-guide'),
  ('เทคนิคการเดินเงิน', 'money-management'),
  ('การอ่านเค้าไพ่', 'card-pattern-reading'),
  ('ทริคระดับเซียน', 'expert-tricks'),
  ('เทคนิคบาคาร่า', 'baccarat-techniques'),
  ('สูตรบาคาร่าฟรี', 'free-baccarat-formula'),
  ('วิธีเล่น', 'how-to-play'),
  ('เทคนิคการเดิมพัน', 'betting-techniques');

-- =============================================
-- 5. DEFAULT ADMIN USER (Seed Data)
-- =============================================
INSERT OR IGNORE INTO users (id, email, password, role) VALUES
  ('admin-uid', 'admin', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME', 'admin');
