// API Dispatch - Netlify Function (CommonJS)
const { Pool } = require('pg');

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

async function githubDispatch(pendingRouteId) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) return 'skipped';

  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `token ${token}`,
        'content-type': 'application/json',
        accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        event_type: 'calculate_routes',
        client_payload: { pending_route_id: pendingRouteId },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('GitHub dispatch failed:', resp.status, text);
      return 'failed';
    }

    return 'sent';
  } catch (error) {
    console.error('GitHub dispatch error:', error);
    return 'error';
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return json(500, { error: 'DATABASE_URL not configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const payload = body.payload || body;
  if (!payload || Object.keys(payload).length === 0) {
    return json(400, { error: 'payload is required' });
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  try {
    const { rows } = await pool.query(
      'insert into pending_routes (payload, status) values ($1::jsonb, $2) returning id::text as id',
      [JSON.stringify(payload), 'pending']
    );

    const pendingRouteId = rows[0].id;
    const dispatchStatus = await githubDispatch(pendingRouteId);

    return json(200, {
      pending_route_id: pendingRouteId,
      github_dispatch: dispatchStatus,
    });
  } catch (error) {
    console.error('Database error:', error);
    return json(500, { error: 'Database error', details: error.message });
  } finally {
    await pool.end();
  }
};
