import 'dotenv/config';
import { query } from './src/db.js';

async function test() {
  const info = await query("PRAGMA table_info(authors)");
  console.log(info);
}
test();
