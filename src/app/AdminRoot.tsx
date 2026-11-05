import { RequireOwner } from './guards/RequireOwner'

/**
 * Punto de entrada del área /admin, cargado bajo demanda para que los
 * visitantes del catálogo no descarguen el código del panel.
 */
export default function AdminRoot() {
  return <RequireOwner />
}
