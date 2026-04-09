const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 to avoid Render IPv6 connectivity issues with Supabase
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = pool;
