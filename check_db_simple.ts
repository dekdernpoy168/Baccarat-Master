
import { Database } from "@sqlitecloud/drivers";

async function checkDb() {
  const connectionString = "sqlitecloud://cjr9vthpvk.g4.sqlite.cloud:8860/bgm-database?apikey=y5jXshHEP9qJ5TSOM2ehp9XYB6idcYAnw9XnPliYYII";
  const sqliteDb = new Database(connectionString);
  
  try {
    const articles = await sqliteDb.sql`SELECT * FROM articles;`;
    console.log("Articles count:", articles.length);
    console.log("Articles:", JSON.stringify(articles, null, 2));
  } catch (err) {
    console.error("Error checking DB:", err);
  }
}

checkDb();
