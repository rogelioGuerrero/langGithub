import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '../lib/cn'

export type Vehicle = {
  id_vehicle: string
  capacity_weight: string
  capacity_volume: string
  skills: string
}

type Props = {
  vehicles: Vehicle[]
  onChange: (vehicles: Vehicle[]) => void
}

export function VehicleForm({ vehicles, onChange }: Props) {
  const set = (i: number, v: Vehicle) => {
    const next = [...vehicles]
    next[i] = v
    onChange(next)
  }

  const add = () => {
    onChange([...vehicles, {
      id_vehicle: `V-${vehicles.length + 1}`,
      capacity_weight: '',
      capacity_volume: '',
      skills: '',
    }])
  }

  const remove = (i: number) => onChange(vehicles.filter((_, idx) => idx !== i))

  const setSkills = (i: number, skill: string) => {
    const cleaned = skill
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    set(i, { ...vehicles[i], skills: cleaned.join(',') })
  }

  return (
    <div className="space-y-3">
      {vehicles.map((v, i) => (
        <div key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <input
              type="text"
              placeholder="ID Vehículo"
              value={v.id_vehicle}
              onChange={(e) => set(i, { ...v, id_vehicle: e.target.value })}
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
              placeholder="Capacidad Peso (kg)"
              value={v.capacity_weight}
              onChange={(e) => set(i, { ...v, capacity_weight: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
            <input
              type="number"
              step="any"
              placeholder="Capacidad Volumen (m³)"
              value={v.capacity_volume}
              onChange={(e) => set(i, { ...v, capacity_volume: e.target.value })}
              className={cn(
                'rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
                'placeholder:text-slate-500',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
              )}
            />
          </div>

          <input
            type="text"
            placeholder="Skills (separados por coma, ej: refrigerado,camion_grande)"
            value={v.skills}
            onChange={(e) => setSkills(i, e.target.value)}
            className={cn(
              'w-full rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-xs',
              'placeholder:text-slate-500',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-200/30',
            )}
          />
        </div>
      ))}

      <Button onClick={add} variant="secondary">
        + Agregar Vehículo
      </Button>
    </div>
  )
}
