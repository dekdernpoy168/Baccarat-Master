import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

const DATABASE_URL = process.env.SQLITE_CLOUD_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('Missing SQLITE_CLOUD_URL or DATABASE_URL in .env');
}

console.log('Initializing database connection with URL:', DATABASE_URL.replace(/apikey=[^&]+/, 'apikey=***'));

export type SqlParam = string | number | null | undefined;

export async function query<T = any>(sql: string, params: SqlParam[] = []): Promise<T[]> {
  const db = new Database(DATABASE_URL!);

  try {
    // If the URL doesn't specify a database, try to automatically select one
    const url = new URL(DATABASE_URL!);
    const hasDatabaseInPath = url.pathname && url.pathname !== '/' && url.pathname !== '';
    
    if (!hasDatabaseInPath) {
      try {
        const databases = await db.sql('LIST DATABASES;');
        console.log('Available databases:', JSON.stringify(databases));
        
        const dbList = Array.isArray(databases) ? databases : [];
        const contentDb = dbList.find(d => {
          const name = (d.name || d.DATABASE || d.database || '').toString().toLowerCase();
          return name === 'content.sqlite';
        });

        if (contentDb) {
          console.log('Found content.sqlite, using it...');
          await db.sql('USE DATABASE content.sqlite;');
        } else {
          // Try to create content.sqlite
          console.log('content.sqlite not found. Attempting to create it...');
          try {
            await db.sql('CREATE DATABASE content.sqlite;');
            await db.sql('USE DATABASE content.sqlite;');
            console.log('Created and using database: content.sqlite');
          } catch (createErr) {
            console.warn('Could not create content.sqlite, selecting first available user database...');
            
            const userDbs = dbList.filter(d => {
              const name = (d.name || d.DATABASE || d.database || '').toString();
              return name && !name.startsWith('_') && name.toLowerCase() !== 'sqlitecloud';
            });
            
            if (userDbs.length > 0) {
              const targetDb = userDbs[0];
              const dbName = targetDb.name || targetDb.DATABASE || targetDb.database;
              console.log(`Automatically selecting user database: ${dbName}`);
              await db.sql(`USE DATABASE ${dbName};`);
            } else if (dbList.length > 0) {
              const firstDb = dbList[0];
              const dbName = firstDb.name || firstDb.DATABASE || firstDb.database;
              console.log(`No user databases found, falling back to first available: ${dbName}`);
              await db.sql(`USE DATABASE ${dbName};`);
            } else {
              console.error('No databases available and could not create default.');
            }
          }
        }
      } catch (listErr) {
        console.warn('Failed to list databases or select one:', listErr);
        // Last ditch effort
        try {
          await db.sql('USE DATABASE content.sqlite;');
        } catch (e) {
          console.error('Final attempt to use content.sqlite failed:', e);
        }
      }
    }

    // The sql method can take a string and parameters
    const result = await db.sql(sql, ...params.map((value) => (value === undefined ? null : value)));
    return Array.isArray(result) ? (result as T[]) : [];
  } catch (error) {
    console.error(`Database query error [${sql}]:`, error);
    throw error;
  } finally {
    db.close();
  }
}

export async function exec(sql: string, params: SqlParam[] = []): Promise<void> {
  await query(sql, params);
}
