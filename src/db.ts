import 'dotenv/config';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;

if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID) {
  console.warn('Missing Cloudflare D1 configuration in .env. Database operations will fail.');
}

export type SqlParam = string | number | null | undefined;

export async function query<T = any>(sql: string, params: SqlParam[] = [], silent: boolean = false): Promise<T[]> {
  if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID) {
    throw new Error('Cloudflare D1 configuration is missing');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params: params.map(p => p === undefined ? null : p),
      }),
    });

    const data: any = await response.json();

    if (!data.success) {
      const errorMsg = data.errors?.[0]?.message || 'Unknown D1 error';
      throw new Error(`D1 Query Error: ${errorMsg}`);
    }

    // D1 returns an array of results for each query in the batch
    // Since we only send one query, we take the first result
    const result = data.result[0];
    
    if (!result.success) {
      throw new Error(`D1 Query Error: ${result.errors?.[0]?.message || 'Query failed'}`);
    }

    return Array.isArray(result.results) ? (result.results as T[]) : [];
  } catch (error) {
    if (!silent) {
      console.error(`Database query error [${sql}]:`, error);
    }
    throw error;
  }
}

export async function exec(sql: string, params: SqlParam[] = [], silent: boolean = false): Promise<void> {
  await query(sql, params, silent);
}
