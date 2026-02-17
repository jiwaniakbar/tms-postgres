import { Pool } from 'pg';

// Use environment variables or fallback to hardcoded local credentials (for migration only)
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'jiwania',
  password: process.env.POSTGRES_PASSWORD || 'admin@123',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'tms',
  options: '-c timezone=Asia/Kolkata'
});

// Test connection
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

export const dbQuery = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getPool = () => pool;
