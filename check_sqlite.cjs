const { Database } = require('@sqlitecloud/drivers');
const db = new Database("sqlitecloud://cjr9vthpvk.g4.sqlite.cloud:8860/auth.sqlitecloud?apikey=y5jXshHEP9qJ5TSOM2ehp9XYB6idcYAnw9XnPliYYII");
db.sql`SELECT name FROM sqlite_master WHERE type='table';`.then(console.log).catch(console.error);
