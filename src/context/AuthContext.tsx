import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type UserRole = 'customer' | 'planner' | 'driver' | null

interface User {
  id: string
  name: string
  role: UserRole
  email?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, role: UserRole) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Credenciales de demo (en producción, esto va en backend)
const DEMO_USERS = [
  { email: 'planificador@demo.com', password: 'demo123', role: 'planner' as UserRole, name: 'Planificador Demo' },
  { email: 'conductor@demo.com', password: 'demo123', role: 'driver' as UserRole, name: 'Conductor Demo' },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Recuperar sesión de localStorage
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string, role: UserRole): Promise<boolean> => {
    // Clientes no necesitan login
    if (role === 'customer') {
      const customerUser = { id: 'customer-1', name: 'Cliente', role: 'customer' as UserRole }
      setUser(customerUser)
      localStorage.setItem('user', JSON.stringify(customerUser))
      return true
    }

    // Validar credenciales para planificador y conductor
    const foundUser = DEMO_USERS.find(u => u.email === email && u.password === password && u.role === role)
    
    if (foundUser) {
      const userData = { 
        id: `${role}-1`, 
        name: foundUser.name, 
        role: foundUser.role,
        email: foundUser.email 
      }
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      return true
    }

    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook para proteger rutas
export function useRequireAuth(allowedRoles: UserRole[]) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login')
      return
    }

    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, navigate])

  return { user, isLoading }
}

import { useNavigate } from 'react-router-dom'
