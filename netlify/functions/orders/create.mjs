import { orderService } from '../../backend/order_service.js';

export async function handler(event, context) {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight de CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    
    // Validaciones básicas
    if (!body.customerName || !body.customerPhone || !body.address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Faltan campos obligatorios: customerName, customerPhone, address' 
        })
      };
    }

    // Crear pedido usando el servicio
    const result = await orderService.createOrder(body);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error creating order:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error.message 
      })
    };
  }
}
