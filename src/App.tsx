import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { InteractiveMap } from './components/InteractiveMap'

type Point = {
  id: string
  lat: number
  lon: number
  type: 'depot' | 'order'
  name?: string
}

type Vehicle = {
  id: string
  capacity: number
  skills: string[]
}

type DispatchResponse = {
  pending_route_id: string
  github_dispatch: 'sent' | 'skipped'
}

type ResultResponse = {
  found: boolean
  pending_route_id: string
  status?: string
  result?: unknown
}

function toPayload(depot: Point, vehicles: Vehicle[], orders: Point[]) {
  const now = new Date()
  const defaultDateTime = (dateStr: string) => {
    if (!dateStr) {
      const d = new Date(now)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    }
    return dateStr
  }

  const defaultEndDateTime = (dateStr: string) => {
    if (!dateStr) {
      const d = new Date(now)
      d.setHours(17, 0, 0, 0)
      return d.toISOString()
    }
    return dateStr
  }

  return {
    depot: {
      lat: depot.lat,
      lon: depot.lon,
      ventana_inicio: defaultDateTime(''),
      ventana_fin: defaultEndDateTime(''),
    },
    vehicles: vehicles.map(v => ({
      id_vehicle: v.id,
      capacity_weight: v.capacity,
      capacity_volume: v.capacity / 200, // Asumir 1kg = 0.005m³
      skills: v.skills,
    })),
    orders: orders.map((o, idx) => ({
      id_pedido: o.name || `P-${idx + 1}`,
      lat: o.lat,
      lon: o.lon,
      peso: 100, // Peso por defecto
      volumen: 0.5, // Volumen por defecto
      ventana_inicio: defaultDateTime(''),
      ventana_fin: defaultEndDateTime(''),
      skills_required: [],
    })),
  }
}

export default function App() {
  const [points, setPoints] = useState<Point[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'VAN-1', capacity: 800, skills: [] },
    { id: 'TRUCK-1', capacity: 4000, skills: [] },
  ])
  const [depot, setDepot] = useState<Point>({ 
    id: 'depot', 
    lat: -34.6037, 
    lon: -58.3816, 
    type: 'depot' 
  })
  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null)
  const [result, setResult] = useState<ResultResponse | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [isCalculating, setIsCalculating] = useState(false)

  const pollInterval = useRef<NodeJS.Timeout>()

  async function calculateRoutes() {
    if (points.length === 0) {
      alert('Por favor, agrega al menos un pedido en el mapa')
      return
    }

    setIsCalculating(true)
    setLog(['Creating pending job + triggering GitHub Actions...'])

    try {
      const payload = toPayload(depot, vehicles, points)
      
      const dispatchRes = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!dispatchRes.ok) {
        throw new Error(`Dispatch failed: ${dispatchRes.status}`)
      }

      const dispatchData: DispatchResponse = await dispatchRes.json()
      setPendingRouteId(dispatchData.pending_route_id)
      
      setLog(prev => [
        ...prev,
        `pending_route_id=${dispatchData.pending_route_id}`,
        `github_dispatch=${dispatchData.github_dispatch}`,
      ])

      // Start polling
      startPolling(dispatchData.pending_route_id)
    } catch (e) {
      setLog(prev => [...prev, `Error: ${e}`])
      setIsCalculating(false)
    }
  }

  function startPolling(id: string) {
    if (pollInterval.current) clearInterval(pollInterval.current)

    const poll = async () => {
      try {
        const res = await fetch(`/api/result?id=${id}`)
        if (!res.ok) {
          if (res.status === 404) {
            setLog(prev => [...prev, `   ...still waiting...`])
            return
          }
          throw new Error(`Result fetch failed: ${res.status}`)
        }

        const data: ResultResponse = await res.json()
        if (data.found) {
          setResult(data)
          setLog(prev => [
            ...prev,
            `✅ Optimization complete! Status: ${data.status}`,
            `Vehicles assigned: ${data.result && typeof data.result === 'object' && 'vehicles' in data.result ? (data.result as any).vehicles.length : 0}`,
          ])
          setIsCalculating(false)
          if (pollInterval.current) clearInterval(pollInterval.current)
        }
      } catch (e) {
        setLog(prev => [...prev, `Error polling: ${e}`])
        setIsCalculating(false)
        if (pollInterval.current) clearInterval(pollInterval.current)
      }
    }

    poll()
    pollInterval.current = setInterval(poll, 3000)
  }

  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [])

  const handlePointsChange = (newPoints: Point[]) => {
    const newDepot = newPoints.find(p => p.type === 'depot')
    if (newDepot) {
      setDepot(newDepot)
    }
    setPoints(newPoints.filter(p => p.type === 'order'))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Route Optimizer
          </h1>
          <p className="text-slate-400 mt-2">
            Clic en el mapa para agregar pedidos y optimizar rutas
          </p>
        </header>

        <InteractiveMap
          onPointsChange={handlePointsChange}
          onVehiclesChange={setVehicles}
          routeResult={result?.result && typeof result.result === 'object' && 'vehicles' in result.result ? result.result as any : undefined}
          depot={depot}
        />

        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={calculateRoutes}
            disabled={isCalculating || points.length === 0}
            className="px-8"
          >
            {isCalculating ? 'Calculando...' : `Calcular Rutas (${points.length} pedidos)`}
          </Button>
        </div>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-black/20 p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-xs text-slate-400">
              pending_route_id: {pendingRouteId ?? '—'}
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-black/20 p-3 text-xs">
              {log.length ? log.join('\n') : '—'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
