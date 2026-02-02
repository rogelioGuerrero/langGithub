import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '../lib/cn'

export type Order = {
  id_pedido: string
  lat: string
  lon: string
  peso: string
  volumen: string
  ventana_inicio: string
  ventana_fin: string
  skills_required: string
}

type Props = {
  orders: Order[]
  onChange: (orders: Order[]) => void
}

export function OrderForm({ orders, onChange }: Props) {
  const set = (i: number, o: Order) => {
    const next = [...orders]
    next[i] = o
    onChange(next)
  }

  const add = () => {
    onChange([...orders, {
      id_pedido: `P-${1001 + orders.length}`,
      lat: '',
      lon: '',
      peso: '',
      volumen: '',
      ventana_inicio: '',
      ventana_fin: '',
      skills_required: '',
    }])
  }

  const remove = (i: number) => onChange(orders.filter((_, idx) => idx !== i))

  const setSkill = (i: number, skill: string) => {
    const cleaned = skill
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    set(i, { ...orders[i], skills_required: cleaned.join(',') })
  }

  return (
    <div className="space-y-3">
      {orders.map((o, i) => (
        <div key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <input
              type="text"
              placeholder="ID Pedido"
              value={o.id_pedido}
              onChange={(e) => set(i, { ...o, id_pedido: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-0.5 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
            <Button variant="secondary" onClick={() => remove(i)}>
              Eliminar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="number"
              step="any"
              placeholder="Lat"
              value={o.lat}
              onChange={(e) => set(i, { ...o, lat: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
            <input
              type="number"
              step="any"
              placeholder="Lon"
              value={o.lon}
              onChange={(e) => set(i, { ...o, lon: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="number"
              step="any"
              placeholder="Peso (kg)"
              value={o.peso}
              onChange={(e) => set(i, { ...o, peso: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
            <input
              type="number"
              step="any"
              placeholder="Volumen (m³)"
              value={o.volumen}
              onChange={(e) => set(i, { ...o, volumen: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="datetime-local"
              value={o.ventana_inicio}
              onChange={(e) => set(i, { ...o, ventana_inicio: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
            <input
              type="datetime-local"
              value={o.ventana_fin}
              onChange={(e) => set(i, { ...o, ventana_fin: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
          </div>

          <input
            type="text"
            placeholder="Skills (separados por coma, ej: refrigerado,camion_grande)"
            value={o.skills_required}
            onChange={(e) => setSkill(i, e.target.value)}
            className={cn(
              'w-full rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
              'placeholder:text-slate-500',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
            )}
          />
        </div>
      ))}

      <Button onClick={add} variant="secondary">
        + Agregar Pedido
      </Button>
    </div>
  )
}
