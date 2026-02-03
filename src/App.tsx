import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { InteractiveMap } from './components/InteractiveMap'

// Páginas
import OrderPage from './pages/OrderPage'
import TrackOrderPage from './pages/TrackOrderPage'
import { PlannerDashboard } from './pages/PlannerDashboard'
import { DriverModule } from './pages/DriverModule'

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
      capacity_volume: v.capacity / 200,
      skills: v.skills,
    })),
    orders: orders.map((o, idx) => ({
      id_pedido: o.name || `P-${idx + 1}`,
      lat: o.lat,
      lon: o.lon,
      peso: 100,
      volumen: 0.5,
      ventana_inicio: defaultDateTime(''),
      ventana_fin: defaultEndDateTime(''),
      skills_required: [],
    })),
  }
}

// Componente Optimizador de Rutas
function RouteOptimizer() {
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

  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null)

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

// Home con navegación a módulos
function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-4">
            Sistema de Gestión de Entregas
          </h1>
          <p className="text-slate-400">
            Selecciona el módulo que necesitas
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:border-blue-500 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-xl">📋 Solicitar Entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">
                ¿Eres cliente? Solicita una entrega completando el formulario.
              </p>
              <Link to="/order">
                <Button className="w-full">Ir al Formulario</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-green-500 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-xl">📦 Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">
                Rastrea tu pedido y conoce el estado de tu entrega.
              </p>
              <Link to="/track/">
                <Button className="w-full" variant="secondary">Rastrear Pedido</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-purple-500 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-xl">🗺️ Planificador</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">
                Gestiona pedidos, asigna conductores y optimiza rutas.
              </p>
              <Link to="/planner">
                <Button className="w-full" variant="secondary">Dashboard</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-orange-500 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-xl">🚗 Módulo Conductor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">
                Accede a tus rutas diarias y actualiza el estado de entregas.
              </p>
              <Link to="/driver">
                <Button className="w-full" variant="secondary">Mis Rutas</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-cyan-500 transition-colors cursor-pointer md:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl">⚡ Optimizador de Rutas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">
                Herramienta avanzada para optimizar múltiples rutas con mapa interactivo.
              </p>
              <Link to="/optimizer">
                <Button className="w-full" variant="secondary">Abrir Optimizador</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/order/:orderId" element={<OrderPage />} />
        <Route path="/track/:orderId" element={<TrackOrderPage />} />
        <Route path="/track" element={<TrackOrderPage />} />
        <Route path="/planner" element={<PlannerDashboard />} />
        <Route path="/driver" element={<DriverModule />} />
        <Route path="/optimizer" element={<RouteOptimizer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}