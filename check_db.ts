
import { Database } from "@sqlitecloud/drivers";

async function checkDb() {
  const connectionString = "sqlitecloud://cjr9vthpvk.g4.sqlite.cloud:8860/bgm-database?apikey=y5jXshHEP9qJ5TSOM2ehp9XYB6idcYAnw9XnPliYYII";
  const sqliteDb = new Database(connectionString);
  
  try {
    const articles = await sqliteDb.sql`SELECT COUNT(*) as count FROM articles;`;
    console.log("Articles count:", articles);
    
    const allArticles = await sqliteDb.sql`SELECT id, title, status, publishedAt FROM articles LIMIT 10;`;
    console.log("Sample articles:", allArticles);
    
    const categories = await sqliteDb.sql`SELECT * FROM categories;`;
    console.log("Categories:", categories);
  } catch (err) {
    console.error("Error checking DB:", err);
  }
}

checkDb();
