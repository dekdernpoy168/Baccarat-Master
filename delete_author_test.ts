import 'dotenv/config';
import { query, exec } from './src/db.js';

async function test() {
  try {
    const authors = await query("SELECT * FROM authors");
    console.log("Authors:", authors);
    if (authors.length > 0) {
       console.log("Trying to delete author ID", authors[0].id);
       await exec("DELETE FROM authors WHERE id = ?", [authors[0].id]);
       const newAuthors = await query("SELECT * FROM authors");
       console.log("Authors after delete:", newAuthors);
    }
  } catch (err) {
    console.error("Error", err);
  }
}
test();
