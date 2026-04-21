import { createContext, useContext } from 'react'

export type PermissionContextType = {
  permissions: Set<string>
  loading: boolean
}

export const PermissionContext = createContext<PermissionContextType>({
  permissions: new Set(),
  loading: true,
})

export function usePermission(required: string): boolean {
  const { permissions, loading } = useContext(PermissionContext)
  if (loading) return false
  return hasPermission(permissions, required)
}

export function usePermissions(...required: string[]): boolean {
  const { permissions, loading } = useContext(PermissionContext)
  if (loading) return false
  return required.every(p => hasPermission(permissions, p))
}

export function useAnyPermission(...required: string[]): boolean {
  const { permissions, loading } = useContext(PermissionContext)
  if (loading) return false
  return required.some(p => hasPermission(permissions, p))
}

export function usePermissionLoading(): boolean {
  const { loading } = useContext(PermissionContext)
  return loading
}

function hasPermission(granted: Set<string>, required: string): boolean {
  if (granted.has('*')) return true
  if (granted.has(required)) return true
  const parts = required.split('.')
  const domain = parts[0]
  if (granted.has(domain + '.*')) return true
  const action = parts.slice(1).join('.')
  if (action && granted.has('*.' + action)) return true
  return false
}
