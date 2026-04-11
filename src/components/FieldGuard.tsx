import { useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { Suspense } from 'react'

function FieldGuardInner({
  children,
  redirectFn,
}: {
  children: React.ReactNode
  redirectFn: (assignment: ReturnType<typeof useUserAssignment>) => string | null
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname
  const [searchParams] = useSearchParams()
  const { isField, loading: roleLoading } = useRole()
  const assignment = useUserAssignment()

  const resolved = !roleLoading && !assignment.loading

  // Compute target URL once resolved
  const target = resolved && isField ? redirectFn(assignment) : null

  // Check if we're already at the target — compare decoded params to handle %20 etc.
  const targetPath = target ? target.split('?')[0] : ''
  const targetQuery = target && target.includes('?') ? target.split('?')[1] : ''
  const alreadyAtTarget = target ? (
    pathname === targetPath &&
    (!targetQuery || (() => {
      // Compare each target param against current searchParams (decoded)
      const tParams = new URLSearchParams(targetQuery)
      for (const [k, v] of tParams.entries()) {
        if (searchParams.get(k) !== v) return false
      }
      return true
    })())
  ) : false

  useEffect(() => {
    if (!resolved || !isField) return
    if (!target || alreadyAtTarget) return
    navigate(target, { replace: true })
  }, [resolved, isField, target, alreadyAtTarget])

  // Block rendering until resolved
  if (!resolved) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  // Field user needs redirect — show loading while navigating
  if (isField && target && !alreadyAtTarget) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  // Either admin, or field user already at correct scoped URL — render
  return <>{children}</>
}

export function FieldGuard({
  children,
  redirectFn,
}: {
  children: React.ReactNode
  redirectFn: (assignment: ReturnType<typeof useUserAssignment>) => string | null
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    }>
      <FieldGuardInner redirectFn={redirectFn}>{children}</FieldGuardInner>
    </Suspense>
  )
}
