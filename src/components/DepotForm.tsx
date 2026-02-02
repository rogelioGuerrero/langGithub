import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'

export type Depot = {
  lat: string
  lon: string
  ventana_inicio: string
  ventana_fin: string
}

type Props = {
  value: Depot
  onChange: (d: Depot) => void
}

export function DepotForm({ value, onChange }: Props) {
  const set = (k: keyof Depot, v: string) => onChange({ ...value, [k]: v })

  const now = new Date()
  const todayLocal = (n = 0) => {
    const d = new Date(now)
    d.setDate(d.getDate() + n)
    d.setHours(8, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  useEffect(() => {
    if (!value.ventana_inicio) set('ventana_inicio', todayLocal())
    if (!value.ventana_fin) set('ventana_fin', todayLocal(0).slice(0, 11) + '18:00')
  }, [])

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Depósito (Lat, Lon)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            placeholder="Lat"
            value={value.lat}
            onChange={(e) => set('lat', e.target.value)}
            className={cn(
              'rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-sm',
              'placeholder:text-slate-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/30',
            )}
          />
          <input
            type="number"
            step="any"
            placeholder="Lon"
            value={value.lon}
            onChange={(e) => set('lon', e.target.value)}
            className={cn(
              'rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-sm',
              'placeholder:text-slate-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/30',
            )}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Ventana de Tiempo</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="datetime-local"
            value={value.ventana_inicio}
            onChange={(e) => set('ventana_inicio', e.target.value)}
            className={cn(
              'rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/30',
            )}
          />
          <input
            type="datetime-local"
            value={value.ventana_fin}
            onChange={(e) => set('ventana_fin', e.target.value)}
            className={cn(
              'rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/30',
            )}
          />
        </div>
      </div>
    </div>
  )
}
