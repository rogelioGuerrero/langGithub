// API Result - Netlify Function (CommonJS)
const { Pool } = require('pg');

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
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

  const { id } = event.queryStringParameters || {};
  if (!id) return json(400, { error: 'id is required' });

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
    const { rows } = await pool.query(
      `select status, result
       from optimized_routes
       where pending_route_id = $1::uuid
       order by created_at desc
       limit 1`,
      [id]
    );

    if (!rows.length) {
      return json(404, { found: false, pending_route_id: id });
    }

    return json(200, {
      found: true,
      pending_route_id: id,
      status: rows[0].status,
      result: rows[0].result,
    });
  } catch (error) {
    console.error('Database error:', error);
    return json(500, { error: 'Database error', details: error.message });
  } finally {
    await pool.end();
  }
};
