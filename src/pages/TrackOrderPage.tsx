import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { ErrorDisplay } from '../components/ErrorDisplay'
import { LoadingScreen } from '../components/Loading'

interface TrackingInfo {
  id: string
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'delivered' | 'cancelled'
  customerName: string
  customerPhone: string
  address: string
  deliveryDate: string
  timeWindow: string
  driverName?: string
  driverPhone?: string
  estimatedArrival?: string
  currentLocation?: {
    lat: number
    lon: number
  }
  route?: {
    vehicleId: string
    stops: Array<{
      id: string
      address: string
      estimatedTime: string
      status: 'pending' | 'completed'
    }>
  }
  createdAt: string
  updatedAt: string
}

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500', description: 'Tu pedido está siendo procesado' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-500', description: 'Pedido confirmado y programado' },
  assigned: { label: 'Asignado', color: 'bg-purple-500', description: 'Conductor asignado a tu entrega' },
  in_progress: { label: 'En Camino', color: 'bg-orange-500', description: 'Tu pedido está en camino' },
  delivered: { label: 'Entregado', color: 'bg-green-500', description: '¡Pedido entregado con éxito!' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500', description: 'El pedido ha sido cancelado' }
}

export default function TrackOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchTrackingInfo(orderId)
      
      // Actualizar cada 30 segundos si está en progreso
      const interval = setInterval(() => {
        fetchTrackingInfo(orderId)
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [orderId])

  const fetchTrackingInfo = async (id: string) => {
    try {
      const response = await fetch(`/.netlify/functions/orders-track/${id}`)
      if (!response.ok) {
        throw new Error('Pedido no encontrado')
      }
      const data = await response.json()
      setTrackingInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar información')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.color || 'bg-gray-500'
  }

  const getStatusLabel = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.label || status
  }

  const getStatusDescription = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.description || ''
  }

  if (loading) {
    return <LoadingScreen message="Cargando información del pedido..." />
  }

  if (error || !trackingInfo) {
    return (
      <ErrorDisplay
        title="Error"
        message={error || 'No se pudo cargar la información del pedido'}
        onRetry={orderId ? () => fetchTrackingInfo(orderId) : undefined}
        onBack={() => navigate('/')}
      />
    )
  }

  const currentStatus = statusConfig[trackingInfo.status]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Seguimiento de Pedido</h1>
          <p className="text-slate-400">ID de seguimiento: {trackingInfo.id}</p>
        </div>

        {/* Estado Actual */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Estado Actual</CardTitle>
              <Badge className={`${currentStatus.color} text-white`}>
                {currentStatus.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">{currentStatus.description}</p>
            
            {/* Timeline de estados */}
            <div className="space-y-3">
              {Object.entries(statusConfig).map(([statusKey, config]) => {
                const isActive = statusKey === trackingInfo.status
                const isCompleted = 
                  ['delivered'].includes(trackingInfo.status) ||
                  (['in_progress', 'delivered'].includes(trackingInfo.status) && 
                   ['pending', 'confirmed', 'assigned'].includes(statusKey)) ||
                  (trackingInfo.status === 'assigned' && ['pending', 'confirmed'].includes(statusKey)) ||
                  (trackingInfo.status === 'confirmed' && statusKey === 'pending')

                return (
                  <div key={statusKey} className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${isCompleted ? 'bg-green-500' : isActive ? config.color : 'bg-gray-600'}`}></div>
                    <div className="flex-1">
                      <p className={`font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>
                        {config.label}
                      </p>
                      <p className="text-sm text-slate-500">{config.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Información del Pedido */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Cliente</p>
                <p className="font-medium">{trackingInfo.customerName}</p>
                <p className="text-sm text-slate-300">{trackingInfo.customerPhone}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Dirección de entrega</p>
                <p className="font-medium">{trackingInfo.address}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Fecha y ventana horaria</p>
                <p className="font-medium">{trackingInfo.deliveryDate}</p>
                <p className="text-sm text-slate-300">{trackingInfo.timeWindow}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Pedido creado</p>
                <p className="font-medium">{formatDateTime(trackingInfo.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Información del Conductor */}
          {trackingInfo.driverName && (
            <Card>
              <CardHeader>
                <CardTitle>Información del Conductor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">Nombre</p>
                  <p className="font-medium">{trackingInfo.driverName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Teléfono</p>
                  <p className="font-medium">{trackingInfo.driverPhone}</p>
                </div>
                {trackingInfo.estimatedArrival && (
                  <div>
                    <p className="text-sm text-slate-400">Hora estimada de llegada</p>
                    <p className="font-medium">{trackingInfo.estimatedArrival}</p>
                  </div>
                )}
                <div className="pt-3">
                  <Button className="w-full" size="sm">
                    📞 Llamar al conductor
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ruta del Vehículo */}
        {trackingInfo.route && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Ruta de Entrega</CardTitle>
              <p className="text-sm text-slate-400">Vehículo: {trackingInfo.route.vehicleId}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trackingInfo.route.stops.map((stop, index) => (
                  <div key={stop.id} className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      stop.status === 'completed' ? 'bg-green-500' : 'bg-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${stop.status === 'completed' ? 'text-green-400' : 'text-slate-300'}`}>
                        {stop.address}
                      </p>
                      <p className="text-sm text-slate-500">{stop.estimatedTime}</p>
                    </div>
                    <Badge className={stop.status === 'completed' ? 'bg-green-500' : 'bg-gray-600'}>
                      {stop.status === 'completed' ? 'Completado' : 'Pendiente'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Acciones */}
        <div className="text-center space-y-3">
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Solicitar otro pedido
          </Button>
          <Button onClick={() => window.print()} variant="secondary" className="w-full">
            🖨️ Imprimir comprobante
          </Button>
        </div>
      </div>
    </div>
  )
}
