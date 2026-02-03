import { useState, useEffect, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export function ErrorBoundary({ children, fallback }: Props) {
  const [state, setState] = useState<State>({ hasError: false, error: null })

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Error capturado:', error)
      setState({ hasError: true, error: error.error })
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (state.hasError) {
    if (fallback) return <>{fallback}</>
    
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-400">Algo salió mal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-400">
              Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
            </p>
            {state.error && (
              <pre className="text-xs text-slate-500 bg-slate-900 p-2 rounded overflow-auto max-h-32">
                {state.error.message}
              </pre>
            )}
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              🔄 Recargar página
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
