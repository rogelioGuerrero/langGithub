// Función simple para crear pedidos - Netlify Function
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function generateOrderId() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    
    if (!body.customerName || !body.customerPhone || !body.address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan campos obligatorios' })
      };
    }

    const orderId = generateOrderId();
    
    const query = `
      INSERT INTO customer_orders (
        id, customer_name, customer_phone, customer_email,
        address, lat, lon, package_name, weight, volume,
        delivery_date, time_window, special_instructions,
        photos, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING id, status, created_at
    `;
    
    const values = [
      orderId,
      body.customerName,
      body.customerPhone,
      body.customerEmail || null,
      body.address,
      body.lat || 0,
      body.lon || 0,
      body.packageName || '',
      body.weight || 1,
      body.volume || 0.1,
      body.deliveryDate || new Date().toISOString().split('T')[0],
      body.timeWindow || '09:00-12:00',
      body.specialInstructions || '',
      JSON.stringify(body.photos || []),
      'pending'
    ];

    const result = await pool.query(query, values);
    const order = result.rows[0];

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        id: order.id,
        status: order.status,
        trackingUrl: `${process.env.URL || ''}/track/${order.id}`,
        createdAt: order.created_at,
        message: `Pedido creado exitosamente. ID: ${order.id}`
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
