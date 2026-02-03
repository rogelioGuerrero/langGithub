// Test de conexión - Netlify Function
const { Pool } = require('pg');

exports.handler = async (event, context) => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'DATABASE_URL not configured' })
    };
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  try {
    // Test simple connection
    const result = await pool.query('SELECT NOW() as now, version() as version');
    
    // Test if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customer_orders'
      );
    `);
    
    // Count rows if table exists
    let count = 0;
    if (tableCheck.rows[0].exists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM customer_orders');
      count = parseInt(countResult.rows[0].count);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: 'connected',
        now: result.rows[0].now,
        table_exists: tableCheck.rows[0].exists,
        customer_orders_count: count,
        env_test: {
          has_db_url: !!databaseUrl,
          db_url_prefix: databaseUrl ? databaseUrl.split('://')[0] : 'none'
        }
      })
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack
      })
    };
  } finally {
    await pool.end();
  }
};
