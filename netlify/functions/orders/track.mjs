import { orderService } from '../../backend/order_service.js';

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const orderId = event.path.split('/').pop();
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Order ID required' })
      };
    }

    const trackingInfo = await orderService.getTrackingInfo(orderId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(trackingInfo)
    };

  } catch (error) {
    console.error('Error getting tracking info:', error);
    
    if (error.message.includes('not found')) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Pedido no encontrado' })
      };
    }

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
