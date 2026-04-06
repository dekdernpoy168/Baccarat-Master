import { exec } from './db';

export async function initSchema() {
  await exec(`PRAGMA foreign_keys = ON;`);

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
      status            TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published')),
      date              TEXT NOT NULL DEFAULT (date('now')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Try to add missing columns to articles
  const articleColumns = [
    'excerpt TEXT',
    'content TEXT NOT NULL DEFAULT \'\'',
    'image TEXT',
    'category TEXT',
    'tags TEXT NOT NULL DEFAULT \'\'',
    'meta_title TEXT',
    'meta_description TEXT',
    'meta_keywords TEXT',
    'author TEXT NOT NULL DEFAULT \'Admin\'',
    'status TEXT NOT NULL DEFAULT \'draft\'',
    'date TEXT NOT NULL DEFAULT (date(\'now\'))',
    'published_at TEXT',
    'created_at TEXT NOT NULL DEFAULT (datetime(\'now\'))',
    'updated_at TEXT NOT NULL DEFAULT (datetime(\'now\'))'
  ];

  for (const col of articleColumns) {
    try {
      await exec(`ALTER TABLE articles ADD COLUMN ${col};`);
    } catch (e) {
      // Ignore error if column already exists
    }
  }

  // Try to add missing columns to categories
  const categoryColumns = [
    'name TEXT NOT NULL UNIQUE',
    'slug TEXT',
    'created_at TEXT NOT NULL DEFAULT (datetime(\'now\'))',
    'updated_at TEXT NOT NULL DEFAULT (datetime(\'now\'))'
  ];

  for (const col of categoryColumns) {
    try {
      await exec(`ALTER TABLE categories ADD COLUMN ${col};`);
    } catch (e) {
      // Ignore error if column already exists
    }
  }

  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);`);
  
  try {
    await exec(`CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);`);
  } catch (e) {
    // Ignore error if column doesn't exist or index already exists
  }

  await exec(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      createdAt TEXT
    );
  `);
}
