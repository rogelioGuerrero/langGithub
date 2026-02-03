interface LoadingProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Loading({ message = 'Cargando...', size = 'md' }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-b-2',
    lg: 'h-16 w-16 border-b-4'
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className={`animate-spin rounded-full ${sizeClasses[size]} border-blue-500`}></div>
      <p className="text-slate-400">{message}</p>
    </div>
  )
}

export function LoadingScreen({ message = 'Cargando...' }: Omit<LoadingProps, 'size'>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <Loading message={message} size="lg" />
    </div>
  )
}
