import {
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/ventas/nueva', label: 'Nueva venta', icon: ShoppingCart },
  { to: '/admin/ventas', label: 'Ventas', icon: Receipt, end: true },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/categorias', label: 'Categorías', icon: FolderTree },
  { to: '/admin/inventario', label: 'Inventario', icon: Boxes },
  { to: '/admin/gastos', label: 'Gastos', icon: Wallet },
  { to: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación principal" className="grid gap-1">
      {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive && 'bg-muted font-medium text-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
