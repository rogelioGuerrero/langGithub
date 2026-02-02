import pgPkg from 'pg'

const { Pool } = pgPkg

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET, OPTIONS',
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

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const id = event.queryStringParameters?.id
  if (!id) return json(400, { error: 'id is required' })

  const pool = await getPool()
  const client = await pool.connect()

  try {
    const { rows } = await client.query(
      `select status, result
       from optimized_routes
       where pending_route_id = $1::uuid
       order by created_at desc
       limit 1`,
      [id],
    )

    if (!rows.length) {
      return {
        statusCode: 404,
        headers: { 'content-type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ found: false, pending_route_id: id }),
      }
    }

    return json(200, {
      found: true,
      pending_route_id: id,
      status: rows[0].status,
      result: rows[0].result,
    })
  } finally {
    client.release()
    await pool.end()
  }
}
