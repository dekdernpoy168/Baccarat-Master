import { query } from './src/db.js';

async function test() {
  try {
    const res = await query('SELECT 1 as val');
    console.log('Success:', res);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
