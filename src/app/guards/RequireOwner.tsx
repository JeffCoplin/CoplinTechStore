import { ShieldX } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOwnerProfile } from '@/features/auth/useOwnerProfile'

/**
 * Guard de /admin: exige sesión y un owner_profiles activo. Es solo la capa de UI;
 * la autorización real la imponen RLS y las funciones de PostgreSQL.
 */
export function RequireOwner() {
  const { session, initializing, signOut } = useAuth()
  const owner = useOwnerProfile()
  const location = useLocation()
  const [rejected, setRejected] = useState(false)

  const notOwner = Boolean(session) && owner.isSuccess && owner.data === null

  useEffect(() => {
    // Un usuario autenticado sin perfil de propietario activo pierde la sesión.
    if (!notOwner) return
    let cancelled = false
    void signOut().finally(() => {
      if (!cancelled) setRejected(true)
    })
    return () => {
      cancelled = true
    }
  }, [notOwner, signOut])

  if (initializing) return <FullScreen><LoadingState label="Verificando sesión…" /></FullScreen>
  if (notOwner || rejected) {
    return (
      <FullScreen>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <ShieldX className="size-10 text-destructive" aria-hidden />
          <h1 className="text-lg font-semibold">Acceso no autorizado</h1>
          <p className="text-sm text-muted-foreground">Esta cuenta no está autorizada como propietaria de CoplinTech. La sesión se cerró.</p>
          <Button asChild variant="outline">
            <Link to="/admin/login" onClick={() => setRejected(false)}>
              Volver al inicio de sesión
            </Link>
          </Button>
        </div>
      </FullScreen>
    )
  }
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (owner.isPending) return <FullScreen><LoadingState label="Verificando permisos…" /></FullScreen>
  if (owner.isError) {
    return (
      <FullScreen>
        <ErrorState error={owner.error} onRetry={() => void owner.refetch()} title="No se pudieron verificar los permisos" />
      </FullScreen>
    )
  }
  return <Outlet />
}

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center p-4">{children}</div>
}
