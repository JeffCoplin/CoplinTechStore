import { Link } from 'react-router'
import { BRAND_ASSETS } from '@/components/navigation/Brand'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
      {/* El conector "desconectado": el ícono de marca, apagado e inclinado. */}
      <img src={BRAND_ASSETS.mark} alt="" aria-hidden width={464} height={376} className="mb-2 w-32 -rotate-12 opacity-30 grayscale" />
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Esta página no está conectada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">La dirección que buscas no existe o fue movida.</p>
      <Button asChild variant="outline">
        <Link to="/catalogo">Ir al catálogo</Link>
      </Button>
    </main>
  )
}
