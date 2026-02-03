import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CustomerOrderForm } from '../components/CustomerOrderForm'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'

interface OrderData {
  customerName: string
  customerPhone: string
  customerEmail: string
  address: string
  lat: number
  lon: number
  packageName: string
  weight: number
  volume: number
  deliveryDate: string
  timeWindow: string
  specialInstructions: string
  photos: string[]
}

export default function OrderPage() {
  const { orderId } = useParams<{ orderId?: string }>()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderData, setOrderData] = useState<Partial<OrderData> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      // Cargar datos del pedido existente
      fetchOrder(orderId)
    }
  }, [orderId])

  const fetchOrder = async (id: string) => {
    try {
      const response = await fetch(`/api/orders/${id}`)
      if (!response.ok) {
        throw new Error('Pedido no encontrado')
      }
      const data = await response.json()
      setOrderData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el pedido')
    }
  }

  const handleSubmit = async (data: OrderData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = orderId ? `/api/orders/${orderId}` : '/api/orders'
      const method = orderId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Error al guardar el pedido')
      }

      const savedOrder = await response.json()

      // Mostrar confirmación
      alert(
        `¡Pedido ${orderId ? 'actualizado' : 'creado'} con éxito!\n\n` +
        `ID de seguimiento: ${savedOrder.id}\n` +
        `Te enviaremos actualizaciones al ${data.customerPhone}`
      )

      // Redirigir a página de seguimiento
      navigate(`/track/${savedOrder.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 mb-4">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {orderId ? 'Modificar Pedido' : 'Nuevo Pedido de Entrega'}
          </h1>
          <p className="text-slate-400">
            {orderId 
              ? 'Actualiza los datos de tu pedido' 
              : 'Completa el formulario para solicitar tu entrega'
            }
          </p>
        </div>

        {/* Formulario */}
        <CustomerOrderForm
          orderId={orderId}
          initialData={orderData}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>¿Necesitas ayuda? Contactanos al +54 9 11 1234-5678</p>
        </div>
      </div>
    </div>
  )
}
