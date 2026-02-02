import pgPkg from 'pg'

const { Pool } = pgPkg

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  }
}

async function getPool() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  return new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 3,
  })
}

async function githubDispatch(pendingRouteId) {
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN

  if (!owner || !repo || !token) return 'skipped'

  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`

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
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`GitHub dispatch failed: ${resp.status} ${text}`)
  }

  return 'sent'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const body = JSON.parse(event.body || '{}')
  const payload = body.payload || body  // Accept both formats
  if (!payload) return json(400, { error: 'payload is required' })

  const pool = await getPool()

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      'insert into pending_routes (payload, status) values ($1::jsonb, $2) returning id::text as id',
      [JSON.stringify(payload), 'pending'],
    )

    const pendingRouteId = rows[0].id

    const dispatchStatus = await githubDispatch(pendingRouteId)

    return json(200, {
      pending_route_id: pendingRouteId,
      github_dispatch: dispatchStatus,
    })
  } finally {
    client.release()
    await pool.end()
  }
}
