import { query } from './src/db.ts';

async function test() {
  try {
    const res = await query("SELECT name FROM sqlite_master WHERE type='table';");
    console.log('Tables:', res);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
