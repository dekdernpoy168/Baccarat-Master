INSERT OR IGNORE INTO categories (name, slug) VALUES ('วิธีเล่นเบื้องต้น', 'basic-guide');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('เทคนิคการเดินเงิน', 'money-management');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('การอ่านเค้าไพ่', 'card-pattern-reading');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('ทริคระดับเซียน', 'expert-tricks');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('เทคนิคบาคาร่า', 'baccarat-techniques');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('สูตรบาคาร่าฟรี', 'free-baccarat-formula');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('วิธีเล่น', 'how-to-play');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('เทคนิคการเดิมพัน', 'betting-techniques');

INSERT OR IGNORE INTO users (id, email, password, role) VALUES ('admin-uid', 'admin', 'Bankk2599++', 'admin');

INSERT OR IGNORE INTO articles (title, slug, excerpt, content, category, image, author, status, published_at) VALUES ('ยินดีต้อนรับสู่คลังบทความบาคาร่า', 'welcome-to-baccarat-articles', 'เริ่มต้นเรียนรู้เทคนิคและสูตรบาคาร่าที่นี่', '<h2>ยินดีต้อนรับ</h2><p>นี่คือบทความแรกของคุณ</p>', 'เทคนิคบาคาร่า', 'https://picsum.photos/seed/baccarat/800/600', 'Admin', 'published', datetime('now'));
