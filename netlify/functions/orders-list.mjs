// Listar pedidos - Netlify Function
const { Pool } = require('pg');

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Content-Type',
  'access-control-allow-methods': 'GET, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return json(500, { error: 'DATABASE_URL not configured' });
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  try {
    const params = event.queryStringParameters || {};
    let query = 'SELECT * FROM customer_orders';
    let whereClause = [];
    let values = [];

    if (params.status && params.status !== 'all') {
      whereClause.push(`status = $${values.length + 1}`);
      values.push(params.status);
    }

    if (params.date) {
      whereClause.push(`delivery_date = $${values.length + 1}`);
      values.push(params.date);
    }

    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);

    return json(200, result.rows);

  } catch (error) {
    console.error('Database error:', error);
    return json(500, { error: 'Database error', details: error.message });
  } finally {
    await pool.end();
  }
};
