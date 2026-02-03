// Ruta del conductor - Netlify Function
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // En producción, identificar al conductor por token/auth
    // Por ahora, obtener pedidos asignados para hoy
    const today = new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        id, customer_name, customer_phone, address, lat, lon,
        time_window, special_instructions, status, delivery_date,
        (SELECT COUNT(*) FROM customer_orders 
         WHERE status IN ('assigned', 'in_progress') 
         AND delivery_date = $1) as total_stops
      FROM customer_orders 
      WHERE status IN ('assigned', 'in_progress')
        AND delivery_date = $1
      ORDER BY 
        CASE status 
          WHEN 'in_progress' THEN 1 
          WHEN 'assigned' THEN 2 
          ELSE 3 
        END,
        time_window
    `;

    const result = await pool.query(query, [today]);

    const deliveries = result.rows.map((row, index) => ({
      id: row.id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      address: row.address,
      lat: row.lat,
      lon: row.lon,
      timeWindow: row.time_window,
      specialInstructions: row.special_instructions,
      status: row.status,
      orderInRoute: index + 1,
      totalStops: parseInt(row.total_stops)
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        vehicleId: 'VAN-1', // En producción, obtener del conductor autenticado
        date: today,
        deliveries: deliveries,
        totalDistance: 0, // Calcular con ORS si es necesario
        estimatedDuration: deliveries.length * 15 // Estimación simple
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
    };
  }
};
