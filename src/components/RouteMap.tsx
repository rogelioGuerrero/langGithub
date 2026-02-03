import { useEffect, useRef } from 'react'

type Route = {
  id_vehicle: string
  skills: string[]
  stops: Array<{
    kind: string
    id: string
    lat: number
    lon: number
    time_arrival: number
  }>
}

type Props = {
  routes: Route[]
  depot: { lat: number; lon: number }
}

export function RouteMap({ routes, depot }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current || !window.L) return

    const map = window.L.map(mapRef.current).setView([depot.lat, depot.lon], 12)

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
    }).addTo(map)

    // Colors for different vehicles
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

    // Depot marker
    window.L.marker([depot.lat, depot.lon])
      .addTo(map)
      .bindPopup('Depósito')
      .setIcon(
        window.L.divIcon({
          className: 'bg-slate-800 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold',
          html: '🏢',
        })
      )

    // Draw routes
    routes.forEach((route, idx) => {
      const color = colors[idx % colors.length]
      const coords = route.stops.map((s) => [s.lat, s.lon] as [number, number])

      // Draw polyline
      if (coords.length > 1) {
        window.L.polyline(coords, { color, weight: 3, opacity: 0.7 }).addTo(map)
      }

      // Add markers for orders
      route.stops.forEach((stop) => {
        if (stop.kind === 'order') {
          window.L.marker([stop.lat, stop.lon])
            .addTo(map)
            .bindPopup(`${stop.id}<br/>Vehicle: ${route.id_vehicle}<br/>Arrival: ${Math.round(stop.time_arrival / 60)}min`)
            .setIcon(
              window.L.divIcon({
                className: 'rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-white',
                html: `<div style="background-color: ${color}">📦</div>`,
              })
            )
        }
      })
    })

    return () => {
      map.remove()
    }
  }, [routes, depot])

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <div ref={mapRef} className="h-96 w-full" />
    </div>
  )
}
