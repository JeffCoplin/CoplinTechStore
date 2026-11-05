import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { PublicLayout } from './layouts/PublicLayout'
import NotFoundPage from './NotFoundPage'

// El área /admin se carga bajo demanda: el catálogo público no descarga el panel.
const AdminRoot = lazy(() => import('./AdminRoot'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })))

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const PosPage = lazy(() => import('@/features/pos/PosPage'))
const SalesListPage = lazy(() => import('@/features/sales/SalesListPage'))
const SaleDetailPage = lazy(() => import('@/features/sales/SaleDetailPage'))
const ProductsPage = lazy(() => import('@/features/products/ProductsPage'))
const ProductFormPage = lazy(() => import('@/features/products/ProductFormPage'))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const CatalogPage = lazy(() => import('@/features/catalog/CatalogPage'))
const CatalogProductPage = lazy(() => import('@/features/catalog/CatalogProductPage'))

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/catalogo" replace /> },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminRoot />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'ventas/nueva', element: <PosPage /> },
          { path: 'ventas', element: <SalesListPage /> },
          { path: 'ventas/:id', element: <SaleDetailPage /> },
          { path: 'productos', element: <ProductsPage /> },
          { path: 'productos/nuevo', element: <ProductFormPage /> },
          { path: 'productos/:id', element: <ProductFormPage /> },
          { path: 'categorias', element: <CategoriesPage /> },
          { path: 'inventario', element: <InventoryPage /> },
          { path: 'gastos', element: <ExpensesPage /> },
          { path: 'reportes', element: <ReportsPage /> },
          { path: 'configuracion', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    path: '/catalogo',
    element: <PublicLayout />,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: ':slug', element: <CatalogProductPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
