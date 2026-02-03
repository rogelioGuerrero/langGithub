// Tracking de pedido - Netlify Function
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
    const orderId = event.path.split('/').pop();
    
    if (!orderId || orderId === 'track') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Order ID requerido' }) };
    }

    const query = `
      SELECT 
        id, status, customer_name, customer_phone, address,
        delivery_date, time_window, driver_name, driver_phone,
        estimated_arrival, lat, lon, created_at, updated_at
      FROM customer_orders 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [orderId]);
    
    if (result.rows.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Pedido no encontrado' }) };
    }

    const order = result.rows[0];

    // Obtener historial de estados
    const historyQuery = `
      SELECT status, timestamp, notes 
      FROM order_status_history 
      WHERE order_id = $1 
      ORDER BY timestamp DESC
    `;
    const historyResult = await pool.query(historyQuery, [orderId]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: order.id,
        status: order.status,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        address: order.address,
        deliveryDate: order.delivery_date,
        timeWindow: order.time_window,
        driverName: order.driver_name,
        driverPhone: order.driver_phone,
        estimatedArrival: order.estimated_arrival,
        currentLocation: order.lat ? { lat: order.lat, lon: order.lon } : null,
        history: historyResult.rows,
        createdAt: order.created_at,
        updatedAt: order.updated_at
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
