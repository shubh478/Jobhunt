const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 globally - this is the key fix for Render + Supabase
dns.setDefaultResultOrder('ipv4first');

// Also override lookup to force IPv4 family
const origLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof options === 'number') {
    options = { family: options };
  }
  options = Object.assign({}, options, { family: 4 });
  return origLookup.call(dns, hostname, options, callback);
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = pool;
