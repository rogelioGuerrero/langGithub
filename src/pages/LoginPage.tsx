import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<'planner' | 'driver'>('planner')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const success = await login(email, password, selectedRole)
    
    if (success) {
      // Redirigir según el rol
      if (selectedRole === 'planner') {
        navigate('/planner')
      } else if (selectedRole === 'driver') {
        navigate('/driver')
      }
    } else {
      setError('Credenciales inválidas')
    }
    
    setLoading(false)
  }

  const handleDemoLogin = () => {
    // Auto-login como planner para testing
    login('planificador@demo.com', 'demo123', 'planner')
    navigate('/planner')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
            <p className="text-slate-400 text-sm mt-2">
              Accede al sistema de gestión de entregas
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selector de rol */}
              <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectedRole('planner')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    selectedRole === 'planner'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🗺️ Planificador
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('driver')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    selectedRole === 'driver'
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🚗 Conductor
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={selectedRole === 'planner' ? 'planificador@demo.com' : 'conductor@demo.com'}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="text-xs text-slate-500 bg-slate-800/50 p-2 rounded">
                <strong>Demo:</strong> Usa las credenciales que se muestran arriba. Contraseña: <code>demo123</code>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">O</span>
                </div>
              </div>

              <Button 
                type="button" 
                variant="secondary" 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={handleDemoLogin}
              >
                🚀 Modo Demo - Entrar como Planificador
              </Button>

              <div className="text-center">
                <Link to="/" className="text-sm text-slate-400 hover:text-white">
                  ← Volver al inicio
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Opción para clientes */}
        <Card className="mt-4">
          <CardContent className="p-4 text-center">
            <p className="text-slate-400 text-sm mb-2">
              ¿Eres cliente?
            </p>
            <Link to="/order">
              <Button variant="secondary" className="w-full">
                📋 Solicitar entrega sin login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
