// Crear pedidos de prueba - Netlify Function
const { Pool } = require('pg');

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Content-Type',
  'access-control-allow-methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
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
    // Insertar pedidos de prueba
    const orders = [
      {
        id: 'ORD-20260203-0001',
        customer_name: 'Ana García',
        customer_phone: '11-2345-6789',
        customer_email: 'ana@email.com',
        address: 'Av. Corrientes 1500, Buenos Aires',
        lat: -34.6037,
        lon: -58.3816,
        package_name: 'Caja pequeña',
        weight: 2.5,
        volume: 0.05,
        delivery_date: '2026-02-03',
        time_window: '09:00-12:00',
        special_instructions: 'Entregar en recepción',
        status: 'pending'
      },
      {
        id: 'ORD-20260203-0002',
        customer_name: 'Carlos López',
        customer_phone: '11-3456-7890',
        customer_email: 'carlos@email.com',
        address: 'Santa Fe 1200, Buenos Aires',
        lat: -34.5895,
        lon: -58.3951,
        package_name: 'Documento importante',
        weight: 0.5,
        volume: 0.01,
        delivery_date: '2026-02-03',
        time_window: '10:00-13:00',
        special_instructions: 'Llamar antes de llegar',
        status: 'pending'
      },
      {
        id: 'ORD-20260203-0003',
        customer_name: 'María Rodríguez',
        customer_phone: '11-4567-8901',
        customer_email: 'maria@email.com',
        address: 'Córdoba 800, Buenos Aires',
        lat: -34.6012,
        lon: -58.3837,
        package_name: 'Paquete mediano',
        weight: 5.0,
        volume: 0.15,
        delivery_date: '2026-02-03',
        time_window: '14:00-17:00',
        special_instructions: '',
        status: 'pending'
      }
    ];

    let inserted = 0;
    for (const order of orders) {
      try {
        await pool.query(`
          INSERT INTO customer_orders (
            id, customer_name, customer_phone, customer_email, address, 
            lat, lon, package_name, weight, volume, delivery_date, time_window,
            special_instructions, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          ) ON CONFLICT (id) DO NOTHING
        `, [
          order.id, order.customer_name, order.customer_phone, order.customer_email,
          order.address, order.lat, order.lon, order.package_name, order.weight,
          order.volume, order.delivery_date, order.time_window, order.special_instructions,
          order.status
        ]);
        inserted++;
      } catch (e) {
        console.error(`Error inserting order ${order.id}:`, e);
      }
    }

    return json(200, {
      message: `Inserted ${inserted} test orders`,
      total_orders: orders.length
    });
  } catch (error) {
    console.error('Database error:', error);
    return json(500, { error: 'Database error', details: error.message });
  } finally {
    await pool.end();
  }
};
