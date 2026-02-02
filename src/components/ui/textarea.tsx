import * as React from 'react'
import { cn } from '../../lib/cn'

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[180px] w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm',
        'placeholder:text-slate-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/30',
        className,
      )}
      {...props}
    />
  )
}
