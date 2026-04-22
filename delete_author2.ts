import 'dotenv/config';
import { query, exec } from './src/db.js';
async function test() {
  await exec("DELETE FROM authors WHERE name = 'test2'");
  console.log(await query("SELECT * FROM authors"));
}
test();
