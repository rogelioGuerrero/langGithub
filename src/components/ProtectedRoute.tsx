import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingScreen } from './Loading'

type UserRole = 'customer' | 'planner' | 'driver' | null

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallback?: ReactNode
}

export function ProtectedRoute({ children, allowedRoles, fallback }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen message="Verificando acceso..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user && !allowedRoles.includes(user.role)) {
    return fallback ? <>{fallback}</> : <Navigate to="/" replace />
  }

  return <>{children}</>
}
