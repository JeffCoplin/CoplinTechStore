import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">La dirección que buscas no existe o fue movida.</p>
      <Button asChild variant="outline">
        <Link to="/catalogo">Ir al catálogo</Link>
      </Button>
    </main>
  )
}
