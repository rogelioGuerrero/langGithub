import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { LoadingScreen } from '../components/Loading'
import { ErrorDisplay } from '../components/ErrorDisplay'

interface Delivery {
  id: string
  customerName: string
  customerPhone: string
  address: string
  lat: number
  lon: number
  timeWindow: string
  specialInstructions: string
  status: 'pending' | 'in_progress' | 'completed'
  estimatedTime: string
  orderInRoute: number
  totalStops: number
}

interface DriverRoute {
  vehicleId: string
  date: string
  deliveries: Delivery[]
  totalDistance: number
  estimatedDuration: number
}

export function DriverModule() {
  const [route, setRoute] = useState<DriverRoute | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [activeDelivery, setActiveDelivery] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDriverRoute()
    // Obtener ubicación actual
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          })
        },
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      )
    }
  }, [])

  const fetchDriverRoute = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/.netlify/functions/driver-route')
      if (!response.ok) {
        throw new Error('Error al cargar la ruta')
      }
      const data = await response.json()
      setRoute(data)
    } catch (error) {
      console.error('Error fetching route:', error)
      setError(error instanceof Error ? error.message : 'Error al cargar la ruta')
    } finally {
      setLoading(false)
    }
  }

  const startDelivery = (deliveryId: string) => {
    setActiveDelivery(deliveryId)
    updateDeliveryStatus(deliveryId, 'in_progress')
  }

  const completeDelivery = (deliveryId: string) => {
    updateDeliveryStatus(deliveryId, 'completed')
    setActiveDelivery(null)
    fetchDriverRoute() // Actualizar lista
  }

  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    try {
      const response = await fetch(`/.netlify/functions/orders-update/${deliveryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!response.ok) {
        throw new Error('Error al actualizar estado')
      }
    } catch (error) {
      console.error('Error updating delivery status:', error)
      setError('Error al actualizar el estado de la entrega')
    }
  }

  const openNavigation = (lat: number, lon: number) => {
    // Abrir Google Maps o Waze
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
    window.open(url, '_blank')
  }

  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  if (loading) {
    return <LoadingScreen message="Cargando tu ruta..." />
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Error"
        message={error}
        onRetry={fetchDriverRoute}
      />
    )
  }

  if (!route || route.deliveries.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Sin entregas asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 mb-4">
              No tienes entregas asignadas para hoy.
            </p>
            <Button onClick={fetchDriverRoute}>
              🔄 Actualizar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedCount = route.deliveries.filter(d => d.status === 'completed').length
  const progress = (completedCount / route.deliveries.length) * 100

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Mis Entregas</h1>
          <p className="text-slate-400">{route.date}</p>
          
          {/* Progreso */}
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span>Progreso</span>
              <span>{completedCount} / {route.deliveries.length}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </header>

        {/* Lista de entregas */}
        <div className="space-y-3">
          {route.deliveries.map((delivery, index) => (
            <Card 
              key={delivery.id}
              className={`${
                delivery.status === 'completed' 
                  ? 'opacity-60' 
                  : activeDelivery === delivery.id 
                    ? 'ring-2 ring-blue-500' 
                    : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm text-slate-400">
                        Entrega #{delivery.orderInRoute}
                      </span>
                      {delivery.status === 'completed' && (
                        <span className="text-green-500 text-sm">✓ Completado</span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold">{delivery.customerName}</h3>
                    <p className="text-sm text-slate-400 mb-2">{delivery.address}</p>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-slate-800 px-2 py-1 rounded">
                        {delivery.timeWindow}
                      </span>
                      <span className="text-xs text-slate-500">
                        Est: {delivery.estimatedTime}
                      </span>
                    </div>

                    {delivery.specialInstructions && (
                      <p className="text-xs text-yellow-400 mb-2">
                        📝 {delivery.specialInstructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                {delivery.status !== 'completed' && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => openNavigation(delivery.lat, delivery.lon)}
                    >
                      🗺️ Navegar
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => callCustomer(delivery.customerPhone)}
                    >
                      📞 Llamar
                    </Button>
                  </div>
                )}

                {delivery.status === 'pending' && activeDelivery !== delivery.id && (
                  <Button
                    className="w-full mt-2"
                    onClick={() => startDelivery(delivery.id)}
                  >
                    ▶️ Iniciar Entrega
                  </Button>
                )}

                {activeDelivery === delivery.id && (
                  <Button
                    className="w-full mt-2 bg-green-600 hover:bg-green-700"
                    onClick={() => completeDelivery(delivery.id)}
                  >
                    ✓ Marcar Entregado
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info de ruta */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Resumen de Ruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Distancia total:</span>
                <span>{(route.totalDistance / 1000).toFixed(1)} km</span>
              </div>
              <div className="flex justify-between">
                <span>Tiempo estimado:</span>
                <span>{Math.round(route.estimatedDuration / 60)} min</span>
              </div>
              <div className="flex justify-between">
                <span>Vehículo:</span>
                <span>{route.vehicleId}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botón de emergencia */}
        <Button 
          variant="secondary" 
          className="w-full mt-4"
          onClick={() => window.open('tel:+541112345678', '_self')}
        >
          🆘 Contactar Planificador
        </Button>
      </div>
    </div>
  )
}
