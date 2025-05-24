const { Pool } = require('pg');
require('dotenv').config();

// Connection parameters via DATABASE_URL or individual env vars
const connectionString = process.env.DATABASE_URL || null;

const pool = connectionString
  ? new Pool({ connectionString, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'invaluable',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};