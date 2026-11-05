# CoplinTech POS — Product Requirements Document (PRD)

**Producto:** CoplinTech POS para CoplinTech  
**Versión del documento:** 1.0  
**Estado:** Especificación inicial para desarrollo  
**Idioma de la aplicación:** Español  
**País / zona horaria:** República Dominicana / `America/Santo_Domingo`  
**Moneda:** Peso dominicano (`DOP`, mostrado como `RD$`)  
**Tipo de producto:** Aplicación web privada de punto de venta e inventario, conectada a un catálogo público de solo lectura.

---

## 1. Resumen ejecutivo

CoplinTech POS será el sistema interno de CoplinTech para administrar productos, existencias, ventas físicas, gastos y resultados del negocio. El mismo proyecto tendrá un catálogo público que permitirá a los clientes consultar los productos publicados, sus precios y su estado de disponibilidad actualizado.

CoplinTech POS se construirá para **una sola tienda y una sola cuenta propietaria**. No será un SaaS multiempresa ni un POS comercial para revender. La prioridad es mantenerlo sencillo, rápido, seguro y fácil de mantener.

La aplicación tendrá dos áreas claramente separadas:

1. **Administración privada (`/admin`)**: requiere autenticación del propietario. Permite gestionar el catálogo, registrar ventas físicas, administrar el inventario, registrar gastos y consultar reportes.
2. **Catálogo público (`/catalogo`)**: no requiere inicio de sesión. Solo permite consultar productos activos y publicados, precios, descripciones, imágenes y disponibilidad general. No permite comprar ni pagar en línea.

Ambas áreas utilizarán un único proyecto Supabase y una única fuente de verdad para los datos.

## 2. Decisiones de producto confirmadas

Estas decisiones son requisitos, no sugerencias:

| Tema | Decisión |
|---|---|
| Tienda | CoplinTech, una sola tienda |
| Usuarios administrativos | Una sola cuenta: el propietario |
| Registro público de usuarios | Deshabilitado |
| Ventas | Solamente ventas físicas registradas por el propietario |
| Catálogo público | Sí, conectado a los datos de CoplinTech POS |
| Disponibilidad pública | Estados: `Disponible`, `Pocas unidades`, `Agotado` |
| Cantidad exacta en catálogo | No mostrarla nunca |
| Pedidos online | Fuera del alcance inicial |
| Carrito / checkout público | Fuera del alcance inicial |
| Pagos online | Fuera del alcance inicial |
| Métodos de pago para ventas físicas | Efectivo, transferencia y tarjeta |
| Contacto del catálogo | Enlace a WhatsApp configurable |
| Moneda | DOP / RD$ |
| Idioma | Español |
| Zona horaria | `America/Santo_Domingo` |
| Interfaz | Moderna, limpia, priorizar modo oscuro y responsive |
| Backend | Supabase (PostgreSQL, Auth, Storage y Realtime) |
| Frontend | React + Vite + TypeScript |

## 3. Objetivos

### 3.1 Objetivos principales

- Centralizar el catálogo, el inventario y las ventas físicas de CoplinTech.
- Registrar ventas de forma rápida y reducir errores humanos.
- Descontar existencias automáticamente al completar una venta.
- Mantener un historial auditable de cada movimiento de inventario.
- Consultar ventas, costos, ganancia bruta y gastos por períodos.
- Publicar un catálogo de productos que se actualice cuando cambien los datos o la disponibilidad.
- Proteger los datos privados del negocio, especialmente costos, existencias exactas, ventas y gastos.

### 3.2 Indicadores de éxito

La primera versión se considerará exitosa cuando:

- El propietario pueda crear y editar productos y categorías.
- El propietario pueda registrar una venta física y el inventario se actualice una sola vez.
- Una venta anulada restaure las existencias mediante un movimiento compensatorio, sin borrar el historial.
- Los reportes calculen resultados a partir de datos persistidos, no de valores simulados.
- Un visitante público pueda consultar el catálogo sin autenticarse.
- El catálogo no exponga costos, cantidades exactas, ventas, gastos ni datos internos.
- Los cambios relevantes de catálogo y disponibilidad se reflejen en la vista pública en tiempo real o casi en tiempo real, con una alternativa de recarga segura.
- La aplicación compile y pase las pruebas esenciales antes de publicarse.

## 4. Usuarios y permisos

### 4.1 Propietario

Es el único usuario administrativo de esta versión. Puede:

- Iniciar y cerrar sesión.
- Crear, editar, activar, desactivar y publicar productos.
- Crear y administrar categorías.
- Registrar entradas y ajustes de inventario.
- Registrar ventas físicas.
- Consultar y anular ventas.
- Registrar y consultar gastos.
- Consultar dashboard y reportes.
- Modificar la configuración de la tienda y el número de WhatsApp.

### 4.2 Visitante / cliente

No necesita cuenta. Puede:

- Ver productos activos y publicados.
- Buscar productos y filtrar por categoría.
- Ver precio, imagen, descripción y estado general de disponibilidad.
- Abrir WhatsApp con un mensaje prellenado para consultar por un producto.

No puede:

- Ver costos, márgenes, cantidades exactas ni movimientos de inventario.
- Ver ventas, gastos, reportes ni información de autenticación.
- Modificar productos ni realizar operaciones de escritura.
- Crear pedidos, pagar o reservar productos en la primera versión.

## 5. Alcance funcional

### 5.1 Autenticación y acceso privado

**Requisitos:**

- Crear una pantalla de inicio de sesión en `/admin/login`.
- Proteger todas las rutas `/admin/*` con un guard de autenticación y autorización del propietario.
- No implementar registro abierto, recuperación por preguntas, invitaciones de empleados ni roles de empleados.
- El usuario propietario se creará manualmente desde Supabase Auth durante la configuración inicial. Su perfil autorizado se vinculará con `auth.uid()`.
- Si un usuario autenticado no tiene un perfil de propietario activo, debe ser rechazado y cerrar o invalidar el acceso administrativo.
- Implementar cierre de sesión.
- Mantener la sesión de forma segura utilizando el cliente oficial de Supabase.
- No colocar claves privadas ni `service_role` en el frontend.

**Criterios de aceptación:**

- Un visitante no autenticado no puede abrir ninguna pantalla administrativa.
- Un usuario autenticado que no esté autorizado como propietario tampoco puede operar el sistema.
- No existe una página pública para crear cuentas.
- Al cerrar sesión, las páginas privadas dejan de ser accesibles.

### 5.2 Dashboard

El dashboard es la página principal del panel administrativo.

**Tarjetas e indicadores:**

- Ventas del día.
- Ventas del mes.
- Ganancia bruta del período.
- Gastos registrados del período.
- Resultado operativo estimado.
- Número de ventas completadas.
- Ticket promedio.
- Productos con pocas unidades.
- Productos agotados.

**Gráficos y listas:**

- Ventas por día o por semana dentro del período seleccionado.
- Comparación con el período anterior equivalente, cuando haya datos suficientes.
- Productos más vendidos por unidades e importe.
- Distribución de ventas por método de pago.
- Lista de productos que requieren reposición.

**Filtros:**

- Hoy.
- Últimos 7 días.
- Este mes.
- Mes anterior.
- Rango personalizado.

**Reglas de cálculo:**

- Solo las ventas con estado `completed` forman parte de las métricas.
- Las ventas anuladas se excluyen de ventas, costos vendidos, ganancias y ticket promedio.
- `Ventas netas` = subtotal − descuento.
- `Costo vendido` = suma de costo unitario histórico × cantidad en las líneas de venta completadas.
- `Ganancia bruta` = ventas netas − costo vendido.
- `Resultado operativo estimado` = ganancia bruta − gastos registrados dentro del período.
- `Ticket promedio` = ventas netas / número de ventas completadas. Si no hay ventas, mostrar RD$0.00.
- Todas las fechas y límites de período deben interpretarse en `America/Santo_Domingo`.

**Nota financiera:** el resultado operativo es una estimación interna. No es una utilidad contable, declaración fiscal ni estado financiero oficial.

### 5.3 Productos y categorías

**Productos:**

Cada producto deberá permitir guardar:

- Nombre (obligatorio).
- Slug único para la ruta pública.
- SKU opcional, único si se proporciona.
- Código de barras opcional, si se decide incluir en la UI inicial.
- Marca opcional.
- Categoría.
- Descripción.
- Precio de costo.
- Precio de venta.
- Existencia actual.
- Umbral de pocas unidades.
- Imagen principal.
- Estado activo/inactivo.
- Estado publicado/no publicado.
- Fecha de creación y última actualización.

**Reglas:**

- El precio de costo debe ser mayor o igual a cero.
- El precio de venta debe ser mayor que cero.
- Las existencias y el umbral deben ser enteros mayores o iguales a cero.
- El formulario de edición de producto no debe cambiar directamente el stock existente. Las existencias se cambian desde Inventario para conservar el historial.
- Al crear un producto, una existencia inicial mayor que cero debe generar un movimiento `initial_stock`.
- Un producto con historial de ventas o movimientos no debe borrarse físicamente. Debe poder desactivarse.
- Un producto inactivo o no publicado no aparece en el catálogo público.
- Si se cambia el costo o precio después de una venta, los datos históricos de esa venta no cambian.
- La eliminación de una imagen debe manejarse sin romper registros históricos; si la imagen se usa en un producto activo, primero se actualiza o elimina la referencia.

**Categorías:**

- Crear, editar, activar y desactivar categorías.
- Cada categoría tendrá nombre, slug y orden de visualización.
- No eliminar físicamente una categoría que tenga productos asociados; permitir desactivarla o reasignar los productos.
- El catálogo solo mostrará categorías activas que tengan productos publicados.

**Carga de imágenes:**

- Usar Supabase Storage.
- Validar tipo MIME y tamaño en el cliente y en las políticas/flujo de carga que correspondan.
- Aceptar formatos web comunes: JPG, PNG y WebP.
- Mostrar vista previa y permitir reemplazar la imagen.
- Guardar la ruta del objeto o URL pública estable en la base de datos.

### 5.4 Inventario

**Funciones:**

- Ver existencia actual de cada producto en el panel privado.
- Registrar entradas de mercancía (restock).
- Registrar ajustes positivos o negativos con motivo obligatorio.
- Consultar el historial de movimientos por producto y período.
- Filtrar productos agotados y con pocas unidades.

**Estados calculados:**

- `out_of_stock`: existencia = 0.
- `low_stock`: existencia > 0 y existencia ≤ umbral.
- `available`: existencia > umbral.

El estado se debe calcular en una única lógica del lado de la base de datos o en una función compartida claramente definida. No mantener un campo de estado manual que pueda desincronizarse con la existencia.

**Reglas:**

- No permitir que una operación deje las existencias negativas.
- Cada entrada, ajuste, venta o anulación debe crear su registro en `stock_movements`.
- Guardar la existencia anterior, el cambio aplicado y la existencia resultante, o datos equivalentes suficientes para auditar el movimiento.
- Los ajustes requieren motivo.
- Los movimientos no se borran ni modifican desde la interfaz normal.

### 5.5 Punto de venta (POS) y ventas físicas

El POS debe ser rápido y cómodo para uso diario en escritorio, pero también usable en pantallas pequeñas.

**Flujo:**

1. Buscar un producto por nombre o SKU.
2. Añadirlo al carrito.
3. Cambiar cantidades y retirar productos del carrito.
4. Mostrar subtotal.
5. Aplicar un descuento total opcional, expresado en DOP.
6. Calcular total.
7. Seleccionar método de pago.
8. Para efectivo, introducir el importe recibido y calcular el cambio.
9. Confirmar la venta.
10. Mostrar confirmación y opción de imprimir un recibo interno.

**Métodos de pago de la primera versión:**

- `cash` (efectivo).
- `bank_transfer` (transferencia).
- `card` (tarjeta).

Solo se permite un método de pago por venta en la primera versión. No implementar pagos divididos.

**Validaciones:**

- No aceptar cantidades cero, negativas o decimales.
- No aceptar artículos inactivos.
- No aceptar una venta si la existencia no alcanza.
- El descuento no puede ser negativo ni mayor que el subtotal.
- El total no puede ser negativo.
- Para efectivo, el importe recibido debe ser igual o superior al total; el cambio es recibido − total.
- Para transferencia y tarjeta, recibido y cambio se pueden guardar como total y cero respectivamente.
- Los precios y costos deben obtenerse o verificarse en la base de datos al confirmar. Nunca confiar en totales, costos o precios enviados únicamente desde el navegador.
- Prevenir doble envío accidental. Utilizar una clave de idempotencia o mecanismo equivalente.

**Integridad transaccional:**

La confirmación de una venta debe ejecutarse en una sola transacción de base de datos, preferiblemente mediante una función RPC PostgreSQL (`create_sale`). Esta operación deberá:

- Comprobar que el usuario es el propietario autorizado.
- Validar productos y cantidades.
- Bloquear las filas de inventario necesarias para evitar ventas concurrentes sobre las mismas unidades.
- Leer precios y costos actuales desde la base de datos.
- Calcular subtotal, descuento y total del lado de la base de datos.
- Guardar la venta y las líneas con snapshots históricos de nombre/SKU, precio unitario y costo unitario.
- Descontar existencias.
- Crear movimientos `sale`.
- Retornar el ID y número de venta.
- Revertir todo si cualquier paso falla.

**Número de venta:**

- Generado por la base de datos.
- Único y legible, por ejemplo `CP-000001`.
- No generado por el navegador.

**Recibo:**

- Mostrar número, fecha, artículos, cantidades, precios, subtotal, descuento, total y método de pago.
- Para efectivo, mostrar importe recibido y cambio.
- Permitir impresión desde el navegador.
- Identificarlo como recibo interno de CoplinTech; no presentarlo como comprobante fiscal ni factura con NCF.

### 5.6 Anulación de ventas

- Una venta completada puede anularse únicamente por el propietario.
- La anulación requiere confirmación explícita y motivo obligatorio.
- No borrar la venta ni sus líneas.
- Ejecutar la anulación mediante una función transaccional (`void_sale`).
- Restaurar las existencias de todos los artículos.
- Crear movimientos compensatorios `void_sale` vinculados a la venta original.
- No permitir anular dos veces la misma venta.
- La venta anulada queda excluida de los indicadores y reportes de ventas.
- Conservar fecha, usuario y motivo de la anulación.

### 5.7 Gastos

**Campos:**

- Fecha del gasto.
- Categoría (por ejemplo, publicidad, transporte, embalaje, servicios, otros).
- Descripción.
- Importe en DOP.
- Método de pago opcional.
- Nota opcional.
- Fecha de creación.

**Funciones:**

- Crear, consultar y filtrar gastos.
- Editar o anular un gasto con confirmación y conservación razonable del historial.
- Incluir gastos válidos en el resultado operativo estimado del período.

No implementar contabilidad formal, conciliación bancaria ni impuestos en esta versión.

### 5.8 Historial y reportes

- Historial de ventas con búsqueda por número de venta y filtros por fecha, estado y método de pago.
- Detalle de cada venta y sus artículos.
- Historial de inventario por producto, tipo de movimiento y fecha.
- Reporte de ventas por período.
- Reporte de ganancia bruta por producto y período.
- Reporte de gastos por categoría y período.
- Reporte de métodos de pago.
- Exportación CSV de las tablas/reportes principales, respetando el filtro aplicado.
- Los reportes deben usar datos reales persistidos y cálculos coherentes con el dashboard.

### 5.9 Catálogo público

**Rutas:**

- `/catalogo`: listado público.
- `/catalogo/:slug`: detalle de producto.

**Datos visibles:**

- Nombre.
- Marca, si existe.
- Categoría.
- Descripción.
- Precio de venta.
- Imagen.
- Estado general de disponibilidad.

**No mostrar bajo ninguna circunstancia:**

- Precio de costo.
- Margen o ganancia.
- Cantidad exacta en inventario.
- Umbral de pocas unidades.
- Movimientos de inventario.
- Datos de ventas, gastos o perfil del propietario.

**Comportamiento:**

- Mostrar únicamente productos activos y publicados.
- Permitir búsqueda por texto.
- Permitir filtrar por categoría.
- Mostrar estados `Disponible`, `Pocas unidades` y `Agotado`.
- No mostrar cantidades exactas.
- Si no hay productos publicados, mostrar un estado vacío útil.
- Si falla la conexión, mostrar un mensaje claro y no inventar disponibilidad.
- El botón de WhatsApp utilizará un número configurado por el propietario; si no existe número configurado, ocultar el botón o mostrar una indicación de que el contacto no está configurado.
- El mensaje de WhatsApp puede incluir nombre del producto y enlace a su página pública.
- El catálogo no tendrá carrito, checkout, pedidos, pagos, registro ni perfiles de clientes.

**Actualización de disponibilidad:**

- El catálogo consultará un endpoint seguro (RPC o mecanismo público equivalente) que entregue exclusivamente los campos autorizados.
- Se requiere actualización en tiempo real o casi en tiempo real cuando cambie un producto, su precio, publicación o estado de disponibilidad.
- Preferir Supabase Realtime Broadcast con un payload mínimo y saneado (por ejemplo, ID del producto y tipo de actualización); el cliente volverá a consultar la función pública segura.
- Nunca emitir `NEW`/`OLD` completos ni incluir costos, cantidades exactas o campos privados en eventos públicos.
- Si el canal Realtime no está disponible, la página debe seguir funcionando y poder actualizarse mediante recarga manual o revalidación periódica razonable.
- Implementar manejo de reconexión y evitar suscripciones duplicadas.

### 5.10 Configuración de tienda

Una configuración de tienda única debe contener como mínimo:

- Nombre de tienda, inicialmente `CoplinTech`.
- Número de WhatsApp (vacío hasta que el propietario lo configure).
- Moneda `DOP`.
- Zona horaria `America/Santo_Domingo`.
- Umbral predeterminado de pocas unidades, configurable; cada producto puede sobrescribirlo.

No inventar dirección, teléfono, redes sociales, logo ni datos comerciales que no hayan sido proporcionados. Usar placeholders claros cuando falte información.

## 6. Modelo de datos propuesto

Usar UUID como claves primarias, `timestamptz` para fechas y `numeric(12,2)` para importes. Todas las tablas privadas deben tener RLS habilitado.

### 6.1 `owner_profiles`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `display_name text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

No crear un flujo de registro público. El perfil se crea manualmente durante el bootstrap del propietario.

### 6.2 `categories`

- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `sort_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at`, `updated_at`

### 6.3 `products`

- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `sku text null unique`
- `barcode text null unique`
- `brand text null`
- `category_id uuid null references categories(id)`
- `description text null`
- `cost_price numeric(12,2) not null check (cost_price >= 0)`
- `sale_price numeric(12,2) not null check (sale_price > 0)`
- `stock_quantity integer not null default 0 check (stock_quantity >= 0)`
- `low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0)`
- `image_path text null`
- `is_active boolean not null default true`
- `is_published boolean not null default false`
- `created_at`, `updated_at`

La disponibilidad debe derivarse de `stock_quantity` y `low_stock_threshold`.

### 6.4 `sales`

- `id uuid primary key`
- `sale_number text not null unique` generado en base de datos
- `status text not null check in ('completed','voided')`
- `payment_method text not null check in ('cash','bank_transfer','card')`
- `subtotal numeric(12,2) not null`
- `discount_amount numeric(12,2) not null default 0`
- `total numeric(12,2) not null`
- `amount_received numeric(12,2) not null`
- `change_amount numeric(12,2) not null default 0`
- `note text null`
- `client_request_id uuid not null unique` o mecanismo de idempotencia equivalente
- `created_by uuid not null references auth.users(id)`
- `created_at timestamptz not null default now()`
- `voided_at timestamptz null`
- `voided_by uuid null references auth.users(id)`
- `void_reason text null`

### 6.5 `sale_items`

- `id uuid primary key`
- `sale_id uuid not null references sales(id)`
- `product_id uuid null references products(id)`
- `product_name_snapshot text not null`
- `sku_snapshot text null`
- `quantity integer not null check (quantity > 0)`
- `unit_sale_price numeric(12,2) not null`
- `unit_cost_price numeric(12,2) not null`
- `line_subtotal numeric(12,2) not null`

Los snapshots no deben cambiar aunque el producto sea renombrado, desactivado o modificado posteriormente.

### 6.6 `stock_movements`

- `id uuid primary key`
- `product_id uuid not null references products(id)`
- `movement_type text not null` con valores iniciales `initial_stock`, `restock`, `adjustment`, `sale`, `void_sale`
- `quantity_delta integer not null check (quantity_delta <> 0)`
- `quantity_before integer not null`
- `quantity_after integer not null`
- `sale_id uuid null references sales(id)`
- `reason text null`
- `created_by uuid not null references auth.users(id)`
- `created_at timestamptz not null default now()`

### 6.7 `expenses`

- `id uuid primary key`
- `expense_date date not null`
- `category text not null`
- `description text not null`
- `amount numeric(12,2) not null check (amount > 0)`
- `payment_method text null`
- `note text null`
- `is_voided boolean not null default false`
- `created_by uuid not null references auth.users(id)`
- `created_at`, `updated_at`

### 6.8 `store_settings`

Tabla de una sola fila, protegida para escritura del propietario:

- `id boolean primary key default true check (id = true)`
- `store_name text not null default 'CoplinTech'`
- `whatsapp_number text null`
- `currency_code text not null default 'DOP'`
- `timezone text not null default 'America/Santo_Domingo'`
- `default_low_stock_threshold integer not null default 2`
- `updated_at timestamptz not null default now()`

### 6.9 Índices recomendados

Crear índices para consultas frecuentes:

- `products(category_id)`.
- `products(is_active, is_published)`.
- `products(name)` o índice de búsqueda de texto apropiado.
- `sales(created_at desc)`.
- `sales(status, created_at desc)`.
- `sales(sale_number)` (además de unique).
- `sale_items(sale_id)`.
- `sale_items(product_id)`.
- `stock_movements(product_id, created_at desc)`.
- `expenses(expense_date desc)`.

## 7. Seguridad y protección de datos

La seguridad se debe implementar en la base de datos, no solamente ocultando botones en React.

### 7.1 Reglas obligatorias

- Habilitar RLS en todas las tablas privadas.
- El propietario solo obtiene acceso si `auth.uid()` corresponde a un `owner_profiles.user_id` activo.
- `anon` no debe poder consultar directamente `products`, `sales`, `sale_items`, `stock_movements`, `expenses`, `owner_profiles` ni `store_settings` privados.
- Los clientes públicos accederán a los datos del catálogo mediante una función RPC o interfaz de lectura explícita que proyecte únicamente campos públicos.
- Las funciones `SECURITY DEFINER` deben fijar un `search_path` seguro, calificar objetos cuando aplique, validar la identidad del propietario y tener permisos `EXECUTE` restringidos a los roles necesarios.
- Revocar permisos innecesarios a `PUBLIC` y `anon`.
- No exponer la clave `service_role` en variables `VITE_*`, código fuente, logs del navegador ni repositorio.
- El frontend solo utilizará la URL del proyecto y la clave publicable/anon.
- Las operaciones de inventario y ventas se ejecutarán en funciones transaccionales de la base de datos.
- Validar todos los datos en frontend y backend.
- No confiar en totales, costos, disponibilidad ni precios calculados solamente en el navegador.
- No registrar información sensible en logs.

### 7.2 Catálogo público seguro

La lectura del catálogo debe usar una función pública restringida, por ejemplo:

- `get_public_catalog_products(...)`
- `get_public_catalog_product_by_slug(...)`

Estas funciones solo pueden retornar nombre, slug, marca, categoría pública, descripción, precio de venta, imagen y estado derivado de disponibilidad. No pueden retornar `cost_price`, `stock_quantity`, `low_stock_threshold`, datos de ventas ni campos del propietario.

La implementación de Realtime no debe difundir filas completas de `products`. Difundir solo un identificador y un tipo de cambio; luego el cliente vuelve a consultar la función segura.

### 7.3 Almacenamiento de imágenes

- Lectura pública solo para imágenes del catálogo publicado, según el diseño del bucket.
- Escritura, reemplazo y eliminación solo para el propietario autenticado.
- Validar rutas y tipos de archivo.
- Evitar que una URL de Storage permita modificar contenido.

## 8. Arquitectura técnica

### 8.1 Stack

- React.
- Vite.
- TypeScript.
- React Router.
- Tailwind CSS.
- shadcn/ui.
- Supabase JS.
- TanStack Query para caché y revalidación de consultas.
- React Hook Form + Zod para formularios y validación.
- Recharts para gráficas.
- Lucide React para iconografía.
- Vercel para hosting del frontend.
- Supabase para PostgreSQL, Auth, Storage y Realtime.

No agregar dependencias sin justificar su necesidad.

### 8.2 Estructura sugerida

```text
coplintech/
├── public/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   ├── guards/
│   │   │   └── RequireOwner.tsx
│   │   └── layouts/
│   │       ├── AdminLayout.tsx
│   │       └── PublicLayout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── shared/
│   │   └── navigation/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── pos/
│   │   ├── sales/
│   │   ├── inventory/
│   │   ├── expenses/
│   │   ├── reports/
│   │   ├── catalog/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── currency/
│   │   ├── validation/
│   │   └── utils/
│   ├── types/
│   │   └── database.types.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── .env.example
├── README.md
├── package.json
└── tsconfig.json
```

Cada feature debe organizar su código en componentes, hooks, servicios, schemas y páginas cuando resulte útil. Evitar un único archivo gigante y evitar abstracciones prematuras.

### 8.3 Rutas

| Ruta | Acceso | Pantalla |
|---|---|---|
| `/admin/login` | Público | Inicio de sesión |
| `/admin` | Propietario | Dashboard |
| `/admin/ventas/nueva` | Propietario | POS / nueva venta |
| `/admin/ventas` | Propietario | Historial de ventas |
| `/admin/ventas/:id` | Propietario | Detalle de venta |
| `/admin/productos` | Propietario | Productos |
| `/admin/productos/nuevo` | Propietario | Crear producto |
| `/admin/productos/:id` | Propietario | Editar producto |
| `/admin/categorias` | Propietario | Categorías |
| `/admin/inventario` | Propietario | Inventario y movimientos |
| `/admin/gastos` | Propietario | Gastos |
| `/admin/reportes` | Propietario | Reportes |
| `/admin/configuracion` | Propietario | Configuración |
| `/catalogo` | Público | Listado de productos |
| `/catalogo/:slug` | Público | Detalle de producto |

Una ruta desconocida debe mostrar una página 404 apropiada.

## 9. UX/UI y diseño visual

### 9.1 Dirección visual

- Apariencia moderna, profesional y sobria.
- Modo oscuro como presentación inicial.
- Fondo oscuro neutro, superficies con contraste suficiente y acentos discretos.
- Tipografía legible y jerarquía clara.
- Sidebar para navegación administrativa en escritorio.
- Navegación adaptable para móvil.
- Tablas legibles, filtros claros, formularios consistentes y estados vacíos útiles.
- Evitar animaciones pesadas, exceso de gradientes y elementos decorativos que dificulten el uso diario.
- No inventar un logo oficial ni colores de marca no proporcionados. Usar un wordmark textual `CoplinTech` y permitir sustituirlo después.

### 9.2 Idioma y formatos

- Toda la interfaz en español.
- Fechas presentadas de forma natural para República Dominicana.
- Formato de moneda con `Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })`.
- Las fechas deben manejarse en `America/Santo_Domingo`.
- Evitar errores de un día por conversiones UTC al filtrar fechas.

### 9.3 Estados de interfaz

Todas las pantallas que cargan datos deben tener:

- Estado de carga.
- Estado vacío.
- Estado de error con opción de reintentar.
- Confirmación para acciones destructivas o importantes.
- Mensajes de éxito y error claros.
- Prevención de doble clic en acciones transaccionales.

### 9.4 Accesibilidad y responsive

- Formularios con labels y mensajes de error asociados.
- Contraste adecuado.
- Navegación por teclado en controles principales.
- No depender únicamente del color para comunicar disponibilidad o errores.
- Diseño usable en escritorio, tablet y móvil.

## 10. Requisitos no funcionales

- Mantener el frontend modular y tipado.
- Manejar errores de red y expiración de sesión.
- Usar caché y revalidación de forma coherente.
- No mostrar datos de prueba en producción.
- Evitar consultas innecesarias y seleccionar solo columnas requeridas.
- Paginar tablas e historiales que puedan crecer.
- Usar consultas parametrizadas / APIs oficiales; nunca construir SQL desde texto del usuario.
- Mantener migraciones SQL versionadas en Git.
- Añadir pruebas para lógica financiera, disponibilidad, validación y flujos de inventario.
- Documentar la configuración local y la publicación.

## 11. Fuera del alcance de la versión 1

No desarrollar en esta etapa:

- Múltiples tiendas, sucursales o tenants.
- Usuarios de empleados, roles múltiples o permisos granulares.
- Registro o perfiles de clientes.
- Pedidos, carrito, checkout o pagos online.
- Integración automática con pasarelas de pago.
- Compras a proveedores, órdenes de compra o cuentas por pagar.
- Contabilidad formal, cálculo fiscal, ITBIS, NCF o facturación electrónica.
- Recibos fiscales o afirmaciones de cumplimiento DGII.
- Integración con impresoras térmicas o hardware POS especializado.
- Aplicación móvil nativa.
- Sistema de delivery o cálculo de envíos.
- Programa de puntos, cupones avanzados o afiliados.
- Multi moneda.
- Integraciones automáticas con TikTok, Instagram, Marketplace o WhatsApp Business API.

Cualquier ampliación de este alcance debe documentarse como una versión posterior.

## 12. Fases de implementación

### Fase 0 — Fundación

- Inspeccionar repositorio.
- Crear proyecto React + Vite + TypeScript si está vacío.
- Configurar Tailwind y shadcn/ui.
- Configurar React Router.
- Instalar y configurar Supabase client.
- Crear `.env.example`.
- Crear layout administrativo, layout público y sistema visual base.
- Crear README con instrucciones locales.

**Entregable:** aplicación base que arranca y compila, con rutas iniciales y conexión configurada por variables de entorno.

### Fase 1 — Base de datos y seguridad

- Crear migraciones de tablas, constraints e índices.
- Configurar RLS y políticas del propietario.
- Crear funciones seguras y bootstrap del propietario.
- Crear funciones públicas de catálogo con columnas permitidas.
- Configurar Storage.
- Generar tipos TypeScript de la base de datos.

**Entregable:** esquema versionado y controles de acceso comprobables.

### Fase 2 — Productos y categorías

- CRUD de categorías.
- CRUD de productos.
- Carga de imágenes.
- Activación, desactivación y publicación.
- Creación inicial de inventario mediante movimiento.

**Entregable:** administración de catálogo funcional.

### Fase 3 — Inventario y POS

- Entradas y ajustes de inventario.
- Historial de movimientos.
- Interfaz de carrito.
- Función transaccional de venta.
- Recibo interno imprimible.
- Anulación transaccional.

**Entregable:** ventas físicas e inventario confiables.

### Fase 4 — Gastos, dashboard y reportes

- Registro de gastos.
- Consultas agregadas para indicadores.
- Gráficas y filtros por período.
- Reportes CSV.

**Entregable:** visión financiera interna del negocio.

### Fase 5 — Catálogo público y Realtime

- Listado y detalle público.
- Búsqueda y categorías.
- Estados de disponibilidad.
- WhatsApp configurable.
- Actualizaciones en tiempo real seguras.

**Entregable:** catálogo público conectado a la misma fuente de datos.

### Fase 6 — QA y publicación

- Pruebas unitarias, integración y flujo crítico.
- Revisión de RLS y acceso anónimo.
- Pruebas de regresión de ventas y anulaciones.
- Revisión responsive.
- Configuración de Vercel y variables de producción.
- Documentación de backups y recuperación.

**Entregable:** versión 1 lista para uso real después de configurar el proyecto Supabase y verificar los datos del propietario.

## 13. Criterios de aceptación globales

La versión 1 no se considerará terminada hasta que se demuestre todo lo siguiente:

1. El propietario puede iniciar sesión y acceder al panel.
2. Un visitante no puede consultar datos privados ni abrir rutas administrativas.
3. Un usuario autenticado sin perfil de propietario activo no puede operar el sistema.
4. Se puede crear una categoría y un producto con imagen.
5. El stock inicial crea un movimiento de inventario.
6. Se puede registrar una venta física con cada método de pago admitido.
7. La venta descuenta el inventario exactamente una vez.
8. Dos intentos concurrentes no pueden vender más unidades de las disponibles.
9. Un fallo durante el registro no deja una venta parcial ni un descuento parcial de inventario.
10. Una venta completada se puede anular una sola vez y restaura las existencias.
11. Los cambios posteriores de precio/costo no modifican snapshots históricos.
12. Los gastos afectan el resultado operativo estimado del período correcto.
13. Los cálculos del dashboard coinciden con las ventas, costos y gastos consultados.
14. El catálogo muestra únicamente productos activos y publicados.
15. El catálogo presenta el estado general, pero nunca cantidades exactas ni costos.
16. Un cambio de disponibilidad llega al catálogo mediante Realtime o mecanismo de revalidación de respaldo.
17. Una interrupción de Realtime no deja el catálogo inutilizable.
18. No hay secretos privados en el bundle del frontend ni en Git.
19. La aplicación maneja carga, vacío, error y confirmación en sus flujos principales.
20. `npm run build` y las pruebas definidas pasan sin errores.

## 14. Variables de entorno

Crear un `.env.example` con nombres similares a:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Si el proyecto utiliza la nueva clave publicable de Supabase, usar el nombre apropiado y documentarlo. Nunca añadir `service_role`, claves secretas ni credenciales reales al `.env.example` o al frontend.

Añadir `.env.local` y otros archivos de entorno locales a `.gitignore`.

## 15. Configuración inicial y operación

La documentación del proyecto debe explicar:

1. Crear un proyecto Supabase.
2. Configurar URL y clave pública en el entorno local.
3. Aplicar las migraciones mediante Supabase CLI o el método documentado.
4. Crear manualmente el usuario propietario en Supabase Auth.
5. Insertar su `user_id` en `owner_profiles` mediante un procedimiento administrativo seguro.
6. Configurar el bucket de imágenes y sus políticas.
7. Configurar el número de WhatsApp y los datos de tienda.
8. Ejecutar la aplicación localmente.
9. Publicar el frontend en Vercel.
10. Configurar las variables de entorno de producción.
11. Definir un procedimiento básico de backup y restauración de la base de datos.

No incluir contraseñas reales, tokens ni números telefónicos inventados.

## 16. Riesgos y decisiones técnicas que requieren especial atención

- **Inventario concurrente:** las ventas deben bloquear y validar stock en la base de datos.
- **Doble envío:** cada intento de venta debe ser idempotente.
- **Historial financiero:** precios y costos deben guardarse como snapshots en `sale_items`.
- **Anulaciones:** se deben compensar con movimientos, nunca borrar transacciones.
- **Seguridad pública:** las funciones públicas deben proyectar campos explícitos; no retornar objetos completos de productos.
- **Realtime:** los eventos públicos no pueden contener filas completas ni cantidades exactas.
- **Fechas:** los filtros deben usar el huso horario de Santo Domingo.
- **Cambios de esquema:** toda modificación debe pasar por una migración versionada.
- **Fiscalidad:** el recibo es interno y no sustituye comprobantes fiscales. No afirmar cumplimiento fiscal.

## 17. Principio rector

CoplinTech POS debe priorizar la confiabilidad de los datos antes que la cantidad de funciones. Una venta correcta, un inventario consistente, un dashboard honesto y un catálogo que no filtre información privada son más importantes que añadir funcionalidades avanzadas.

**Fuente de verdad del producto:** este documento (`PRD.md`). Cuando una decisión de implementación parezca contradecirlo, respetar el PRD y documentar cualquier limitación técnica antes de cambiar el alcance.
