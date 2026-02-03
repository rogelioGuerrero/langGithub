import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

interface ErrorDisplayProps {
  title?: string
  message: string
  onRetry?: () => void
  onBack?: () => void
}

export function ErrorDisplay({ 
  title = 'Error', 
  message, 
  onRetry, 
  onBack 
}: ErrorDisplayProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <span>⚠️</span> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-400">{message}</p>
          <div className="flex gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="flex-1">
                🔄 Reintentar
              </Button>
            )}
            {onBack && (
              <Button onClick={onBack} variant="secondary" className="flex-1">
                ← Volver
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface ApiErrorProps {
  error: Error | null
  onRetry: () => void
}

export function ApiError({ error, onRetry }: ApiErrorProps) {
  const message = error?.message || 'Ha ocurrido un error al cargar los datos'
  
  return (
    <Card className="border-red-500/50">
      <CardContent className="p-6 text-center">
        <p className="text-red-400 mb-4">{message}</p>
        <Button onClick={onRetry} size="sm">
          🔄 Reintentar
        </Button>
      </CardContent>
    </Card>
  )
}
