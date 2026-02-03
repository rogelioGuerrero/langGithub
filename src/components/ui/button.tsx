import * as React from 'react'
import { cn } from '../../lib/cn'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

export function Button({ className, variant = 'default', size = 'default', ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/30',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'lg' && 'h-11 px-8 text-base',
        size === 'default' && 'h-9 px-4 py-2',
        variant === 'default' && 'bg-slate-100 text-slate-900 hover:bg-slate-200',
        variant === 'secondary' && 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
        variant === 'outline' && 'border border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800',
        className,
      )}
      {...props}
    />
  )
}
