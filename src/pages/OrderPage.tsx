import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CustomerOrderForm } from '../components/CustomerOrderForm'
import { ErrorDisplay } from '../components/ErrorDisplay'
import { LoadingScreen } from '../components/Loading'
import { useToast } from '../context/ToastContext'

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
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderData, setOrderData] = useState<Partial<OrderData> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!orderId)

  useEffect(() => {
    if (orderId) {
      // Cargar datos del pedido existente
      fetchOrder(orderId)
    }
  }, [orderId])

  const fetchOrder = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/.netlify/functions/orders-track/${id}`)
      if (!response.ok) {
        throw new Error('Pedido no encontrado')
      }
      const data = await response.json()
      setOrderData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el pedido')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: OrderData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = orderId 
        ? `/.netlify/functions/orders-update/${orderId}` 
        : '/.netlify/functions/orders-create'
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

      addToast(
        `¡Pedido ${orderId ? 'actualizado' : 'creado'} exitosamente! ID: ${savedOrder.id}`,
        'success'
      )

      // Redirigir a página de seguimiento
      navigate(`/track/${savedOrder.id}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMsg)
      addToast(errorMsg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingScreen message="Cargando pedido..." />
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Error al cargar el pedido"
        message={error}
        onRetry={orderId ? () => fetchOrder(orderId) : undefined}
        onBack={() => navigate('/')}
      />
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
          initialData={orderData || undefined}
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
