import { ExternalLink, LogOut, Menu } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, Outlet } from 'react-router'
import { AdminNav } from '@/components/navigation/AdminNav'
import { Brand } from '@/components/navigation/Brand'
import { LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/AuthProvider'

export function AdminLayout() {
  const { signOut, session } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const footer = (
    <div className="grid gap-2 border-t pt-4">
      <p className="truncate px-3 text-xs text-muted-foreground" title={session?.user.email}>
        {session?.user.email}
      </p>
      <Button variant="ghost" className="justify-start" asChild>
        <Link to="/catalogo" target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden /> Ver catálogo
        </Link>
      </Button>
      <Button variant="ghost" className="justify-start" onClick={() => void signOut()}>
        <LogOut aria-hidden /> Cerrar sesión
      </Button>
    </div>
  )

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex print:hidden">
        <Brand subtitle="Panel de administración" className="px-3" />
        <div className="flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden print:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col gap-6 p-4">
              <SheetHeader className="p-0">
                <SheetTitle asChild>
                  <div>
                    <Brand subtitle="Panel de administración" className="px-3" />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <AdminNav onNavigate={() => setMobileOpen(false)} />
              </div>
              {footer}
            </SheetContent>
          </Sheet>
          <Brand />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
