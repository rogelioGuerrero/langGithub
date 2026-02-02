import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { DepotForm, type Depot } from './components/DepotForm'
import { OrderForm, type Order } from './components/OrderForm'
import { VehicleForm, type Vehicle } from './components/VehicleForm'
import { RouteMap } from './components/RouteMap'

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

function toPayload(depot: Depot, vehicles: Vehicle[], orders: Order[]) {
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
      lat: parseFloat(depot.lat),
      lon: parseFloat(depot.lon),
      ventana_inicio: defaultDateTime(depot.ventana_inicio),
      ventana_fin: defaultEndDateTime(depot.ventana_fin),
    },
    vehicles: vehicles.map(v => ({
      id_vehicle: v.id_vehicle,
      capacity_weight: parseFloat(v.capacity_weight) || 0,
      capacity_volume: parseFloat(v.capacity_volume) || 0,
      skills: v.skills ? v.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
    })),
    orders: orders.map(o => ({
      id_pedido: o.id_pedido,
      lat: parseFloat(o.lat),
      lon: parseFloat(o.lon),
      peso: parseFloat(o.peso) || 0,
      volumen: parseFloat(o.volumen) || 0,
      ventana_inicio: defaultDateTime(o.ventana_inicio),
      ventana_fin: defaultEndDateTime(o.ventana_fin),
      skills_required: o.skills_required ? o.skills_required.split(',').map(s => s.trim()).filter(Boolean) : [],
    })),
  }
}

export default function App() {
  const [depot, setDepot] = useState<Depot>({
    lat: '-34.6037',
    lon: '-58.3816',
    ventana_inicio: '',
    ventana_fin: '',
  })
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id_vehicle: 'VAN-1',
      capacity_weight: '800',
      capacity_volume: '4',
      skills: 'refrigerado',
    },
    {
      id_vehicle: 'TRUCK-1',
      capacity_weight: '4000',
      capacity_volume: '20',
      skills: 'camion_grande',
    },
  ])
  const [orders, setOrders] = useState<Order[]>([
    {
      id_pedido: 'P-1001',
      lat: '-34.6158',
      lon: '-58.4333',
      peso: '120',
      volumen: '0.5',
      ventana_inicio: '',
      ventana_fin: '',
      skills_required: 'refrigerado',
    },
    {
      id_pedido: 'P-1002',
      lat: '-34.5875',
      lon: '-58.3974',
      peso: '900',
      volumen: '2.0',
      ventana_inicio: '',
      ventana_fin: '',
      skills_required: 'camion_grande',
    },
  ])

  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<ResultResponse | null>(null)

  const pollTimer = useRef<number | null>(null)

  const canRun = useMemo(() => {
    try {
      const payload = toPayload(depot, vehicles, orders)
      return !!payload.depot.lat && !!payload.depot.lon && payload.vehicles.length && payload.orders.length
    } catch {
      return false
    }
  }, [depot, vehicles, orders])

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current)
    }
  }, [])

  async function dispatch() {
    setBusy(true)
    setResult(null)
    setLog([])

    const payload = toPayload(depot, vehicles, orders)

    try {
      setLog((l) => [...l, 'Creating pending job + triggering GitHub Actions...'])
      const resp = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload }),
      })

      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(text || `dispatch failed: ${resp.status}`)
      }

      const data = (await resp.json()) as DispatchResponse
      setPendingRouteId(data.pending_route_id)
      setLog((l) => [...l, `pending_route_id=${data.pending_route_id}`])
      setLog((l) => [...l, `github_dispatch=${data.github_dispatch}`])

      if (pollTimer.current) window.clearInterval(pollTimer.current)
      pollTimer.current = window.setInterval(() => poll(data.pending_route_id), 2500)

      await poll(data.pending_route_id)
    } catch (e) {
      setLog((l) => [...l, `Error: ${(e as Error).message}`])
      setBusy(false)
    }
  }

  async function poll(id: string) {
    try {
      const resp = await fetch(`/api/result?id=${encodeURIComponent(id)}`)
      if (resp.status === 404) {
        setResult({ found: false, pending_route_id: id })
        return
      }
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(text || `result failed: ${resp.status}`)
      }

      const data = (await resp.json()) as ResultResponse
      setResult(data)

      if (data.found && data.status && (data.status === 'ok' || data.status === 'no_solution')) {
        setBusy(false)
        if (pollTimer.current) window.clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    } catch (e) {
      setLog((l) => [...l, `Poll error: ${(e as Error).message}`])
      setBusy(false)
      if (pollTimer.current) window.clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Route Optimizer</h1>
            <p className="text-sm text-slate-400">LangGraph + OR-Tools (CVRPTW) + ORS + Neon</p>
          </div>
          <Button onClick={dispatch} disabled={!canRun || busy}>
            {busy ? 'Running…' : 'Calcular Rutas'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Depósito</CardTitle>
            </CardHeader>
            <CardContent>
              <DepotForm value={depot} onChange={setDepot} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vehículos</CardTitle>
            </CardHeader>
            <CardContent>
              <VehicleForm vehicles={vehicles} onChange={setVehicles} />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderForm orders={orders} onChange={setOrders} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-black/20 p-3 text-xs">
                {JSON.stringify(result ?? { found: false }, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {result?.found && result.result && typeof result.result === 'object' && 'vehicles' in result.result && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Mapa de Rutas</CardTitle>
              </CardHeader>
              <CardContent>
                <RouteMap 
                  routes={(result.result as any).vehicles || []} 
                  depot={{ lat: parseFloat(depot.lat), lon: parseFloat(depot.lon) }} 
                />
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
    </div>
  )
}
