import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

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

interface Props {
  orderId?: string
  initialData?: Partial<OrderData>
  onSubmit: (data: OrderData) => void
  isSubmitting?: boolean
}

export function CustomerOrderForm({ orderId, initialData, onSubmit, isSubmitting = false }: Props) {
  const [formData, setFormData] = useState<OrderData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    address: '',
    lat: 0,
    lon: 0,
    packageName: '',
    weight: 1,
    volume: 0.1,
    deliveryDate: new Date().toISOString().split('T')[0],
    timeWindow: '09:00-12:00',
    specialInstructions: '',
    photos: []
  })

  const [locationLoading, setLocationLoading] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const geocodeAddress = async (address: string) => {
    if (!address) return
    
    setLocationLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`
      )
      const data = await response.json()
      
      if (data.length > 0) {
        const first = data[0]
        setFormData(prev => ({
          ...prev,
          lat: parseFloat(first.lat),
          lon: parseFloat(first.lon)
        }))
        
        // Guardar sugerencias
        setAddressSuggestions(data.map((item: any) => item.display_name))
      }
    } catch (error) {
      console.error('Error geocoding address:', error)
    } finally {
      setLocationLoading(false)
    }
  }

  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, address: value }))
    
    // Debounce geocoding
    const timeoutId = setTimeout(() => {
      geocodeAddress(value)
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Convertir a base64
    Promise.all(
      files.map(file => new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      }))
    ).then(photos => {
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...photos] }))
    })
  }

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones básicas
    if (!formData.customerName || !formData.customerPhone || !formData.address) {
      alert('Por favor completa los campos obligatorios')
      return
    }
    
    if (formData.lat === 0 || formData.lon === 0) {
      alert('Por favor selecciona una dirección válida')
      return
    }
    
    onSubmit(formData)
  }

  const timeWindows = [
    '08:00-10:00',
    '09:00-12:00',
    '10:00-13:00',
    '11:00-14:00',
    '12:00-15:00',
    '13:00-16:00',
    '14:00-17:00',
    '15:00-18:00',
    '16:00-19:00',
    '17:00-20:00'
  ]

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          {orderId ? 'Editar Pedido' : 'Nuevo Pedido de Entrega'}
        </CardTitle>
        <p className="text-center text-slate-400">
          Completa los datos para programar tu entrega
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos del Cliente */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Datos del Cliente</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Nombre completo *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Juan Pérez"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="customerPhone">Teléfono *</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="+54 9 11 1234-5678"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="juan@ejemplo.com"
              />
            </div>
          </div>

          {/* Dirección de Entrega */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Dirección de Entrega</h3>
            
            <div>
              <Label htmlFor="address">Dirección completa *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Av. Corrientes 1234, Buenos Aires"
                required
              />
              {locationLoading && (
                <p className="text-sm text-slate-400 mt-1">Buscando ubicación...</p>
              )}
            </div>
            
            {formData.lat !== 0 && formData.lon !== 0 && (
              <div className="text-sm text-slate-400">
                Coordenadas: {formData.lat.toFixed(6)}, {formData.lon.toFixed(6)}
              </div>
            )}
          </div>

          {/* Datos del Paquete */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Datos del Paquete</h3>
            
            <div>
              <Label htmlFor="packageName">Descripción del paquete</Label>
              <Input
                id="packageName"
                value={formData.packageName}
                onChange={(e) => setFormData(prev => ({ ...prev, packageName: e.target.value }))}
                placeholder="Caja con documentos, ropa, etc."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) }))}
                />
              </div>
              
              <div>
                <Label htmlFor="volume">Volumen (m³)</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.volume}
                  onChange={(e) => setFormData(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Programación de Entrega */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Programación de Entrega</h3>
            
            <div>
              <Label htmlFor="deliveryDate">Fecha de entrega</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div>
              <Label htmlFor="timeWindow">Ventana horaria preferida</Label>
              <Select value={formData.timeWindow} onValueChange={(value) => setFormData(prev => ({ ...prev, timeWindow: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeWindows.map(window => (
                    <SelectItem key={window} value={window}>
                      {window}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fotos del Paquete */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Fotos del Paquete (Opcional)</h3>
            
            <div>
              <Label htmlFor="photos">Subir fotos</Label>
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="cursor-pointer"
              />
            </div>
            
            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {formData.photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instrucciones Especiales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Instrucciones Especiales</h3>
            
            <div>
              <Label htmlFor="specialInstructions">Instrucciones adicionales</Label>
              <Textarea
                id="specialInstructions"
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Dejar en recepción, llamar antes de llegar, etc."
                rows={3}
              />
            </div>
          </div>

          {/* Botón de Envío */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting || locationLoading}
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar Pedido'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
