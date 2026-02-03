import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = { id, message, type, duration }
    
    setToasts((prev) => [...prev, newToast])

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Toast Container Component
interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return 'ℹ️'
    }
  }

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'error': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'warning': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'info': return 'bg-blue-500/20 border-blue-500/50 text-blue-400'
      default: return 'bg-slate-500/20 border-slate-500/50 text-slate-400'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 p-4 rounded-lg border shadow-lg animate-slide-in ${getStyles(toast.type)}`}
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <span className="text-lg">{getIcon(toast.type)}</span>
          <p className="flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-current opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
