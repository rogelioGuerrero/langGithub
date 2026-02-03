import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd'
import { LoadingScreen } from '../components/Loading'
import { ErrorDisplay } from '../components/ErrorDisplay'

interface Order {
  id: string
  customerName: string
  customerPhone: string
  address: string
  lat: number
  lon: number
  deliveryDate: string
  timeWindow: string
  weight: number
  volume: number
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'delivered'
  priority: 'high' | 'medium' | 'low'
}

interface Column {
  id: string
  title: string
  orders: Order[]
}

export function PlannerDashboard() {
  const [columns, setColumns] = useState<Record<string, Column>>({
    pending: { id: 'pending', title: 'Pendientes', orders: [] },
    confirmed: { id: 'confirmed', title: 'Confirmados', orders: [] },
    assigned: { id: 'assigned', title: 'Asignados', orders: [] },
    in_progress: { id: 'in_progress', title: 'En Camino', orders: [] },
    delivered: { id: 'delivered', title: 'Entregados', orders: [] }
  })
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/.netlify/functions/orders-list?status=all')
      if (!response.ok) {
        throw new Error('Error al cargar pedidos')
      }
      const data = await response.json()
      organizeOrdersByStatus(data)
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError(error instanceof Error ? error.message : 'Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const organizeOrdersByStatus = (orders: Order[]) => {
    const newColumns = { ...columns }
    Object.keys(newColumns).forEach(key => {
      newColumns[key].orders = []
    })
    
    orders.forEach(order => {
      if (newColumns[order.status]) {
        newColumns[order.status].orders.push(order)
      }
    })
    
    setColumns(newColumns)
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    
    const { source, destination } = result
    if (source.droppableId === destination.droppableId) return

    const sourceColumn = columns[source.droppableId]
    const destColumn = columns[destination.droppableId]
    const [movedOrder] = sourceColumn.orders.splice(source.index, 1)
    
    movedOrder.status = destination.droppableId as Order['status']
    destColumn.orders.splice(destination.index, 0, movedOrder)
    
    setColumns({ ...columns })
    updateOrderStatus(movedOrder.id, destination.droppableId)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/.netlify/functions/orders-update/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!response.ok) {
        throw new Error('Error al actualizar estado')
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      setError('Error al actualizar el estado del pedido')
    }
  }

  const optimizeSelectedOrders = async () => {
    if (selectedOrders.length === 0) return
    
    try {
      setError(null)
      const response = await fetch('/.netlify/functions/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedOrders })
      })
      if (!response.ok) {
        throw new Error('Error al optimizar')
      }
      setSelectedOrders([])
      fetchOrders()
    } catch (error) {
      console.error('Error optimizing orders:', error)
      setError('Error al optimizar los pedidos')
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      assigned: 'bg-purple-500',
      in_progress: 'bg-orange-500',
      delivered: 'bg-green-500'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-500'
  }

  if (loading) {
    return <LoadingScreen message="Cargando pedidos..." />
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Error"
        message={error}
        onRetry={fetchOrders}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Dashboard del Planificador</h1>
              <p className="text-slate-400">Gestiona y optimiza las entregas</p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={optimizeSelectedOrders}
                disabled={selectedOrders.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                Optimizar {selectedOrders.length} pedidos
              </Button>
              <Button variant="secondary" onClick={fetchOrders}>
                🔄 Actualizar
              </Button>
            </div>
          </div>
        </header>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.values(columns).map(column => (
              <div key={column.id} className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge className={getStatusColor(column.id)}>
                    {column.orders.length}
                  </Badge>
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided: DroppableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[200px]"
                    >
                      {column.orders.map((order, index) => (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                          {(provided: DraggableProvided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`cursor-pointer transition-all ${
                                selectedOrders.includes(order.id) 
                                  ? 'ring-2 ring-blue-500' 
                                  : ''
                              }`}
                              onClick={() => toggleOrderSelection(order.id)}
                            >
                              <Card>
                                <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{order.customerName}</p>
                                    <p className="text-xs text-slate-400 truncate">{order.address}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant="outline" className="text-xs">
                                        {order.timeWindow}
                                      </Badge>
                                      <span className="text-xs text-slate-500">
                                        {order.weight}kg
                                      </span>
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={selectedOrders.includes(order.id)}
                                    onChange={() => {}}
                                    className="ml-2"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estadísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total de pedidos hoy:</span>
                  <span className="font-bold">
                    {Object.values(columns).reduce((sum, col) => sum + col.orders.length, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Por entregar:</span>
                  <span className="font-bold text-orange-400">
                    {columns.in_progress.orders.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Entregados:</span>
                  <span className="font-bold text-green-400">
                    {columns.delivered.orders.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" size="sm">
                📋 Generar reporte diario
              </Button>
              <Button className="w-full" size="sm" variant="secondary">
                🗺️ Ver mapa de pedidos
              </Button>
              <Button className="w-full" size="sm" variant="secondary">
                👥 Gestionar conductores
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Links de Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" size="sm">
                🔗 Generar link de pedido
              </Button>
              <p className="text-xs text-slate-400">
                Comparte este link con tus clientes para que soliciten entregas
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
