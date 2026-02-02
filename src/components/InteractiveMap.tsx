import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface Point {
  id: string
  lat: number
  lon: number
  type: 'depot' | 'order'
  name?: string
}

interface Vehicle {
  id: string
  capacity: number
  skills: string[]
}

interface RouteResult {
  vehicles: Array<{
    id_vehicle: string
    stops: Array<{
      id: string
      lat: number
      lon: number
      time_arrival: number
    }>
  }>
}

type Props = {
  onPointsChange: (points: Point[]) => void
  onVehiclesChange: (vehicles: Vehicle[]) => void
  routeResult?: RouteResult
  depot: { lat: number; lon: number }
}

export function InteractiveMap({ onPointsChange, onVehiclesChange, routeResult, depot }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'VAN-1', capacity: 800, skills: [] },
    { id: 'TRUCK-1', capacity: 4000, skills: [] },
  ])
  const [isAddingDepot, setIsAddingDepot] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.L) return

    const leafletMap = window.L.map(mapRef.current).setView([depot.lat, depot.lon], 12)

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(leafletMap)

    setMap(leafletMap)

    // Add initial depot
    const depotMarker = window.L.marker([depot.lat, depot.lon], {
      icon: window.L.divIcon({
        className: 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg',
        html: '🏢',
      })
    }).addTo(leafletMap)
    depotMarker.bindPopup('Depósito (clic para mover)')

    // Make depot draggable
    depotMarker.dragging?.enable()
    depotMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng()
      onPointsChange([{ id: 'depot', lat: pos.lat, lon: pos.lng, type: 'depot' }])
    })

    return () => {
      leafletMap.remove()
    }
  }, [])

  // Handle map clicks
  useEffect(() => {
    if (!map) return

    const handleClick = (e: any) => {
      const { lat, lng } = e.latlng
      
      if (isAddingDepot) {
        // Update depot
        onPointsChange([{ id: 'depot', lat, lon: lng, type: 'depot' }])
        setIsAddingDepot(false)
        
        // Update depot marker
        map.eachLayer((layer: any) => {
          if (layer instanceof window.L.Marker) {
            layer.setLatLng([lat, lng])
          }
        })
      } else {
        // Add order point
        const newPoint: Point = {
          id: `order-${Date.now()}`,
          lat,
          lon: lng,
          type: 'order',
          name: `P-${points.length + 1}`
        }
        
        const updatedPoints = [...points, newPoint]
        setPoints(updatedPoints)
        onPointsChange(updatedPoints)
        
        // Add marker
        const marker = window.L.marker([lat, lng], {
          icon: window.L.divIcon({
            className: 'bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg',
            html: '📦',
          })
        }).addTo(map)
        marker.bindPopup(`${newPoint.name}<br/><button onclick="this.parentElement.parentElement.removePoint('${newPoint.id}')">Eliminar</button>`)
      }
    }

    map.on('click', handleClick)

    return () => {
      map.off('click', handleClick)
    }
  }, [map, isAddingDepot, points, onPointsChange])

  // Draw routes when result changes
  useEffect(() => {
    if (!map || !routeResult) return

    // Clear existing routes
    map.eachLayer((layer: any) => {
      if (layer instanceof window.L.Polyline) {
        map.removeLayer(layer)
      }
    })

    // Colors for different vehicles
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

    // Draw routes
    routeResult.vehicles.forEach((vehicle, idx) => {
      const color = colors[idx % colors.length]
      const coords = vehicle.stops.map(s => [s.lat, s.lon] as [number, number])

      if (coords.length > 1) {
        window.L.polyline(coords, {
          color,
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1
        }).addTo(map)

        // Add arrows to show direction
        for (let i = 0; i < coords.length - 1; i++) {
          const midpoint = [
            (coords[i][0] + coords[i + 1][0]) / 2,
            (coords[i][1] + coords[i + 1][1]) / 2
          ]
          
          window.L.marker(midpoint, {
            icon: window.L.divIcon({
              className: 'text-white',
              html: `<div style="color: ${color}; font-size: 16px;">➤</div>`,
              iconSize: [20, 20]
            })
          }).addTo(map)
        }
      }
    })
  }, [map, routeResult])

  const removePoint = (pointId: string) => {
    const updatedPoints = points.filter(p => p.id !== pointId)
    setPoints(updatedPoints)
    onPointsChange(updatedPoints)
    
    // Remove marker from map
    map.eachLayer((layer: any) => {
      if (layer instanceof window.L.Marker) {
        const popup = layer.getPopup()
        if (popup && popup.getContent().includes(pointId)) {
          map.removeLayer(layer)
        }
      }
    })
  }

  const addVehicle = () => {
    const newVehicle: Vehicle = {
      id: `VEHICLE-${vehicles.length + 1}`,
      capacity: 1000,
      skills: []
    }
    const updated = [...vehicles, newVehicle]
    setVehicles(updated)
    onVehiclesChange(updated)
  }

  const updateVehicle = (id: string, field: keyof Vehicle, value: any) => {
    const updated = vehicles.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    )
    setVehicles(updated)
    onVehiclesChange(updated)
  }

  // Make removePoint available globally
  useEffect(() => {
    ;(window as any).removePoint = removePoint
  }, [points])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Mapa Interactivo
              <div className="space-x-2">
                <Button 
                  size="sm" 
                  variant={isAddingDepot ? "default" : "outline"}
                  onClick={() => setIsAddingDepot(!isAddingDepot)}
                >
                  {isAddingDepot ? 'Clic en el mapa para depósito' : 'Mover Depósito'}
                </Button>
                <Button size="sm" variant="outline">
                  Clic en el mapa para agregar pedidos
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={mapRef} className="h-96 w-full rounded-lg overflow-hidden" />
            <div className="mt-2 text-sm text-slate-400">
              Puntos: {points.length} pedidos | Vehículos: {vehicles.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehículos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="p-2 border border-slate-800 rounded">
                <input
                  type="text"
                  value={vehicle.id}
                  onChange={(e) => updateVehicle(vehicle.id, 'id', e.target.value)}
                  className="w-full mb-1 px-2 py-1 text-sm bg-slate-900 border border-slate-700 rounded"
                />
                <input
                  type="number"
                  placeholder="Capacidad (kg)"
                  value={vehicle.capacity}
                  onChange={(e) => updateVehicle(vehicle.id, 'capacity', Number(e.target.value))}
                  className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-700 rounded"
                />
              </div>
            ))}
            <Button onClick={addVehicle} className="w-full" size="sm">
              + Agregar Vehículo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instrucciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2">
            <p>• Clic en el mapa para agregar pedidos</p>
            <p>• Click derecho en un marcador para eliminar</p>
            <p>• Los pedidos se agregan automáticamente</p>
            <p>• Configura vehículos al lado</p>
            <p>• Click en "Calcular Rutas" para optimizar</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
