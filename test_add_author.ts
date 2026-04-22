import 'dotenv/config';
import { query, exec } from './src/db.js';
async function test() {
  await exec("INSERT INTO authors (name, description, position, image) VALUES ('test2', 'desc', 'pos', 'img')");
  console.log(await query("SELECT * FROM authors"));
}
test();
