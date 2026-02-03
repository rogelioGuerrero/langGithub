import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Loading } from './Loading'

interface Delivery {
  id: string
  customerName: string
  address: string
  lat: number
  lon: number
  status: 'pending' | 'in_progress' | 'completed'
  orderInRoute: number
}

interface LiveMapProps {
  deliveries: Delivery[]
  currentLocation?: { lat: number; lon: number } | null
  activeDeliveryId?: string | null
  onDeliveryClick?: (deliveryId: string) => void
  depotLocation?: { lat: number; lon: number }
}

export function LiveDriverMap({ 
  deliveries, 
  currentLocation, 
  activeDeliveryId,
  onDeliveryClick,
  depotLocation = { lat: -34.6037, lon: -58.3816 }
}: LiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return

    const initMap = async () => {
      try {
        // Check if Leaflet is available
        if (!(window as any).L) {
          throw new Error('Leaflet not loaded')
        }

        const L = (window as any).L

        // Initialize map if not exists
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapRef.current).setView(
            [depotLocation.lat, depotLocation.lon], 
            13
          )

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(mapInstanceRef.current)
        }

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove())
        markersRef.current = []

        // Add depot marker
        const depotIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: #3b82f6; 
            width: 24px; 
            height: 24px; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          ">🏢</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })

        const depotMarker = L.marker([depotLocation.lat, depotLocation.lon], { icon: depotIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup('<strong>Depósito</strong>')
        markersRef.current.push(depotMarker)

        // Add current location marker if available
        if (currentLocation) {
          const currentIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
              background: #10b981; 
              width: 20px; 
              height: 20px; 
              border-radius: 50%; 
              border: 3px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              animation: pulse 1.5s infinite;
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })

          const currentMarker = L.marker([currentLocation.lat, currentLocation.lon], { icon: currentIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup('<strong>Tu ubicación</strong>')
          markersRef.current.push(currentMarker)

          // Center map on current location
          mapInstanceRef.current.panTo([currentLocation.lat, currentLocation.lon])
        }

        // Add delivery markers
        deliveries.forEach((delivery, index) => {
          const isActive = delivery.id === activeDeliveryId
          const isCompleted = delivery.status === 'completed'
          
          const color = isCompleted ? '#6b7280' : isActive ? '#f59e0b' : '#8b5cf6'
          const emoji = isCompleted ? '✓' : isActive ? '📍' : `${index + 1}`

          const deliveryIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
              background: ${color}; 
              width: 28px; 
              height: 28px; 
              border-radius: 50%; 
              border: 3px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: ${isCompleted || isActive ? '14px' : '12px'};
              ${isActive ? 'animation: bounce 1s infinite;' : ''}
            ">${emoji}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })

          const marker = L.marker([delivery.lat, delivery.lon], { icon: deliveryIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`
              <div style="min-width: 200px;">
                <strong>${delivery.customerName}</strong><br/>
                ${delivery.address}<br/>
                <span style="color: ${isActive ? '#f59e0b' : '#6b7280'};">
                  ${isActive ? '📍 Entrega actual' : isCompleted ? '✓ Completada' : `Parada #${index + 1}`}
                </span>
              </div>
            `)
          
          if (onDeliveryClick) {
            marker.on('click', () => onDeliveryClick(delivery.id))
          }
          
          markersRef.current.push(marker)
        })

        // Draw route line if we have current location and deliveries
        if (currentLocation && deliveries.length > 0) {
          const routePoints = [
            [currentLocation.lat, currentLocation.lon],
            ...deliveries
              .filter(d => d.status !== 'completed')
              .map(d => [d.lat, d.lon])
          ]

          if (routePoints.length > 1) {
            const routeLine = L.polyline(routePoints, {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.7,
              dashArray: '10, 10'
            }).addTo(mapInstanceRef.current)
            
            markersRef.current.push(routeLine)
          }
        }

        setIsMapLoading(false)
      } catch (error) {
        console.error('Error initializing map:', error)
        setMapError('Error al cargar el mapa')
        setIsMapLoading(false)
      }
    }

    initMap()

    return () => {
      // Cleanup markers but keep map instance
      markersRef.current.forEach(marker => {
        if (mapInstanceRef.current) {
          marker.remove()
        }
      })
      markersRef.current = []
    }
  }, [deliveries, currentLocation, activeDeliveryId, depotLocation, onDeliveryClick])

  if (mapError) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">{mapError}</p>
          <Button size="sm" onClick={() => window.location.reload()}>
            Recargar
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Mapa en Tiempo Real</span>
          {currentLocation && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              GPS activo
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={mapRef} 
          className="w-full h-80 bg-slate-800 relative"
        >
          {isMapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <Loading message="Cargando mapa..." size="sm" />
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div className="p-3 flex gap-4 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            Tu ubicación
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
            Entrega actual
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-violet-500 rounded-full"></span>
            Pendiente
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
            Completada
          </span>
        </div>
      </CardContent>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </Card>
  )
}
