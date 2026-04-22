import 'dotenv/config';
import { query, exec } from './src/db.js';

async function fixTable() {
  try {
    console.log("Renaming old authors table...");
    await exec("ALTER TABLE authors RENAME TO authors_old_backup;");
    
    console.log("Creating new authors table...");
    await exec(`
      CREATE TABLE authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT,
        description TEXT,
        image TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    console.log("Migrating data...");
    // We only migrate the one valid author:
    // If id is text, we'll let it auto-increment for the new ones, 
    // or just insert the good data.
    
    const oldAuthors = await query("SELECT * FROM authors_old_backup WHERE name IS NOT NULL AND name != 'test'");
    for (const a of oldAuthors) {
         let newId = a.id;
         if (newId === null || newId === 'default-author' || typeof newId === 'string') {
             // allow autoincrement
             await query(
                 `INSERT INTO authors (name, position, description, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                 [a.name, a.position, a.description, a.image, a.created_at, a.updated_at]
             );
         } else {
             // preserve integer id
             await query(
                 `INSERT INTO authors (id, name, position, description, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                 [a.id, a.name, a.position, a.description, a.image, a.created_at, a.updated_at]
             );
         }
    }
    
    console.log("Done syncing table. Check output:");
    const newAuthors = await query("SELECT * FROM authors");
    console.log(newAuthors);

  } catch (err) {
    console.error("Error migrating", err);
  }
}
fixTable();
