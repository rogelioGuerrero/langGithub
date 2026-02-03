// Actualizar estado de pedido - Netlify Function
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'PUT') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const orderId = event.path.split('/').pop();
    const body = JSON.parse(event.body);
    
    if (!body.status) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Status requerido' }) };
    }

    const validStatuses = ['pending', 'confirmed', 'assigned', 'in_progress', 'delivered', 'cancelled'];
    if (!validStatuses.includes(body.status)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Status inválido' }) };
    }

    const query = `
      UPDATE customer_orders 
      SET status = $1, updated_at = NOW()
      ${body.driverName ? ', driver_name = $3' : ''}
      ${body.driverPhone ? ', driver_phone = $4' : ''}
      WHERE id = $2
      RETURNING *
    `;
    
    const values = [body.status, orderId];
    if (body.driverName) values.push(body.driverName);
    if (body.driverPhone) values.push(body.driverPhone);

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Pedido no encontrado' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        order: result.rows[0],
        message: `Estado actualizado a ${body.status}`
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
