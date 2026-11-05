# Prompt maestro para Claude Code — CoplinTech POS

Copia este prompt en Claude Code desde la raíz del repositorio de CoplinTech POS. Mantén `PRD.md` en la raíz del proyecto.

---

Actúa como **arquitecto de software y desarrollador full-stack senior**. Vas a construir CoplinTech POS, el sistema privado de punto de venta e inventario de CoplinTech, siguiendo estrictamente el documento `PRD.md` ubicado en la raíz del repositorio.

## 1. Fuente de verdad y objetivo

1. Lee `PRD.md` completo antes de modificar archivos.
2. El PRD es la fuente de verdad del producto: respeta sus decisiones, alcance, reglas de negocio, seguridad y criterios de aceptación.
3. No conviertas CoplinTech POS en un SaaS, no agregues multiempresa, usuarios de empleados, carrito público, checkout, pedidos online ni pagos online.
4. Las decisiones ya confirmadas son: una tienda CoplinTech, una sola cuenta propietaria, ventas físicas, catálogo público con estados de disponibilidad y sin cantidades exactas, moneda DOP, español y zona horaria `America/Santo_Domingo`.
5. No inventes teléfono, dirección, logo, credenciales, productos reales ni datos comerciales. Usa configuración vacía o placeholders claramente identificados cuando falten datos.

## 2. Forma de trabajo

- Primero inspecciona el repositorio, los archivos existentes, `package.json`, configuración, git status y estructura actual. No sobrescribas trabajo existente sin entenderlo.
- Si el repositorio está vacío, crea el proyecto según el PRD.
- Si ya existe una aplicación, reutiliza lo válido y adapta la arquitectura sin destruir funcionalidades no relacionadas.
- Trabaja por fases en el orden del PRD: fundación, base de datos/seguridad, productos/categorías, inventario/POS, gastos/dashboard/reportes, catálogo/Realtime y QA.
- No te limites a entregar un plan: implementa código real y verificable. Puedes completar una fase por iteración, pero deja el repositorio en un estado funcional y explica claramente qué quedó completado y qué falta.
- Antes de cada fase, resume brevemente el objetivo y los archivos que esperas tocar. Después implementa y ejecuta las verificaciones relevantes.
- No pidas confirmación para decisiones ya definidas en el PRD. Si falta una credencial externa, continúa con la integración preparada mediante variables de entorno y documenta cómo configurarla.
- Si encuentras un conflicto técnico real con el PRD, explica el conflicto, el riesgo y la alternativa más fiel al requisito. No cambies el alcance silenciosamente.
- Mantén los cambios pequeños, coherentes y fáciles de revisar.

## 3. Stack requerido

Usa el stack establecido en el PRD:

- React + Vite + TypeScript.
- React Router.
- Tailwind CSS + shadcn/ui.
- Supabase JS.
- TanStack Query.
- React Hook Form + Zod.
- Recharts.
- Lucide React.
- Supabase PostgreSQL, Auth, Storage y Realtime.
- Vercel como hosting del frontend.

No instales Bootstrap. No agregues librerías redundantes ni dependencias pesadas sin una razón concreta. Comprueba la compatibilidad entre las versiones elegidas y documenta las decisiones importantes.

## 4. Reglas de arquitectura

- Mantén una sola aplicación y una sola base de datos Supabase.
- Separa claramente las áreas `/admin` y `/catalogo`.
- Usa arquitectura modular por feature; evita archivos monolíticos.
- Separa UI, lógica de negocio, validación, consultas y tipos.
- Usa tipos TypeScript estrictos; evita `any` salvo que esté justificado y encapsulado.
- Centraliza el formato monetario DOP y el manejo de fechas de Santo Domingo.
- Usa migraciones SQL versionadas para todos los cambios de esquema.
- Genera y mantiene tipos TypeScript de Supabase cuando corresponda.
- Evita lógica financiera crítica exclusivamente en el frontend.

## 5. Reglas críticas de seguridad

Estas reglas son obligatorias y tienen prioridad sobre la conveniencia de implementación:

1. Habilita RLS en todas las tablas privadas.
2. El acceso administrativo debe requerir una sesión válida y un `owner_profiles` activo asociado a `auth.uid()`.
3. No implementes registro público de usuarios.
4. No uses la clave `service_role` en React, en variables `VITE_*`, en el navegador ni en el repositorio.
5. El cliente web solo puede recibir la URL de Supabase y una clave publicable/anon.
6. Los visitantes anónimos no deben poder consultar directamente tablas privadas como productos completos, ventas, líneas de venta, movimientos, gastos o perfiles.
7. El catálogo público debe consultar una RPC o interfaz de lectura explícita que devuelva únicamente campos permitidos: nombre, slug, marca, categoría pública, descripción, precio de venta, imagen y estado de disponibilidad.
8. Nunca exponer `cost_price`, `stock_quantity`, `low_stock_threshold`, márgenes, ventas, gastos ni movimientos en respuestas o eventos públicos.
9. Las funciones `SECURITY DEFINER` deben fijar `search_path`, validar al propietario, calificar objetos cuando corresponda y restringir correctamente `EXECUTE`.
10. Los uploads y modificaciones de imágenes deben estar limitados al propietario.
11. No confíes en ocultar componentes o rutas como única protección. La autorización real debe estar en PostgreSQL/RLS y en las funciones RPC.
12. No pongas secretos reales en archivos de ejemplo, fixtures, capturas ni logs.

Antes de dar por terminada la seguridad, prueba explícitamente qué puede hacer `anon`, qué puede hacer un usuario autenticado no propietario y qué puede hacer el propietario.

## 6. Reglas críticas de ventas e inventario

La integridad de ventas e inventario es la prioridad técnica más alta.

- Implementa la creación de ventas mediante una función PostgreSQL transaccional, por ejemplo `create_sale`.
- La base de datos debe validar el propietario, los productos, las cantidades, las existencias, el método de pago y el descuento.
- El navegador no puede decidir el costo real, precio real, subtotal ni total definitivo.
- Bloquea las filas de productos necesarias mientras se procesa la venta, para evitar vender unidades simultáneamente por encima del stock.
- Guarda en `sale_items` snapshots de nombre/SKU, precio unitario y costo unitario al momento de la venta.
- Guarda venta, líneas, cambios de stock y movimientos en la misma transacción.
- Implementa idempotencia para prevenir ventas duplicadas por doble clic o reintentos de red.
- No permitas stock negativo.
- La edición normal del producto no debe cambiar directamente el stock; usa operaciones explícitas de inventario.
- Cada entrada o ajuste debe crear un movimiento inmutable con motivo cuando aplique.
- La anulación debe realizarse mediante una función transaccional separada, restaurar el stock, crear movimientos compensatorios y preservar la venta original.
- No borres ventas ni movimientos para corregir errores.
- Excluye ventas anuladas de los reportes y cálculos de desempeño.

Prueba al menos: venta exitosa, stock insuficiente, doble envío, dos intentos concurrentes para la última unidad, fallo a mitad de la transacción y anulación repetida.

## 7. Reglas del catálogo público y Realtime

- Solo lista productos activos y publicados.
- Muestra `Disponible`, `Pocas unidades` o `Agotado`.
- Nunca muestres cantidades exactas.
- No añadas carrito, pedidos, checkout ni pagos en línea.
- El botón de WhatsApp debe depender del número configurado por el propietario; no inventes uno.
- Para Realtime, emite solamente un evento mínimo y saneado (por ejemplo, ID del producto y tipo de cambio) y vuelve a consultar la RPC segura.
- No transmitas `NEW` o `OLD` completos desde la tabla `products`.
- Verifica la API y sintaxis de Supabase Realtime vigentes antes de implementarla. Si no puedes validar el flujo en un entorno conectado, documenta la limitación y deja un fallback funcional mediante revalidación/recarga.
- Implementa reconexión y evita canales duplicados.

## 8. Diseño y experiencia de usuario

- Toda la interfaz debe estar en español.
- Usa modo oscuro como diseño inicial, con apariencia premium, sobria y profesional.
- No inventes identidad visual oficial de CoplinTech; usa `CoplinTech` como wordmark textual.
- Construye una navegación administrativa clara, sidebar en escritorio y adaptación a pantallas pequeñas.
- Prioriza velocidad de uso en el POS.
- Todos los formularios necesitan labels, validación y errores comprensibles.
- Las páginas con datos deben incluir loading, empty, error y retry states.
- Las acciones importantes deben tener confirmación y feedback.
- No utilices solo el color para comunicar estados.
- Formatea DOP con `Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })`.
- Interpreta los períodos de reportes en `America/Santo_Domingo` y evita errores de fecha por UTC.
- No llenes producción con datos ficticios. Los datos de demostración solo pueden estar en fixtures de pruebas o en un seed claramente opcional.

## 9. Calidad del código

- TypeScript estricto.
- Componentes y hooks reutilizables solo cuando exista una necesidad real.
- Validación Zod compartida cuando sea apropiado, sin sustituir validaciones de base de datos.
- Estados de carga y mutación claros.
- Errores capturados y presentados sin filtrar detalles sensibles.
- Consultas paginadas para historiales y tablas grandes.
- No uses `console.log` con datos privados en producción.
- Añade pruebas para cálculos monetarios, disponibilidad, descuentos, cambio, filtros de fecha y reglas de inventario.
- No des por terminada una fase si el proyecto no compila.

## 10. Documentación requerida

Mantén actualizados:

- `README.md`: requisitos, instalación, desarrollo local, build y deploy.
- `.env.example`: solo nombres de variables, sin valores secretos.
- `docs/SUPABASE_SETUP.md`: creación de proyecto, aplicación de migraciones, creación manual del usuario propietario, alta de `owner_profiles`, bucket y políticas de Storage.
- `docs/DEPLOYMENT.md`: configuración de Vercel y variables de producción.
- `docs/SECURITY_CHECKLIST.md`: políticas RLS, permisos, RPC públicas y pruebas de acceso.
- `docs/TESTING.md`: pruebas y comandos.

El PRD debe permanecer en la raíz del proyecto y no debe ser reemplazado por un resumen.

## 11. Verificaciones obligatorias

Al finalizar cada fase, ejecuta los comandos disponibles para:

- Instalar/verificar dependencias.
- Typecheck.
- Lint.
- Pruebas unitarias/integración.
- Build de producción.

Al finalizar el desarrollo, revisa también:

- Que no haya claves privadas en el bundle.
- Que las rutas `/admin` estén protegidas.
- Que el catálogo público no lea tablas privadas directamente.
- Que ningún endpoint público devuelva costos o cantidades exactas.
- Que una venta y su inventario sean atómicos.
- Que una anulación sea idempotente y auditable.
- Que el dashboard excluya ventas anuladas.
- Que el build de producción termine correctamente.

No afirmes que una prueba pasó si no la ejecutaste. Si falta una conexión real de Supabase, distingue con claridad entre pruebas locales, pruebas con mocks y pruebas pendientes de ejecutar contra el proyecto remoto.

## 12. Qué hacer ahora

Comienza ahora con estas acciones:

1. Inspecciona el repositorio y lee `PRD.md` completo.
2. Informa brevemente qué encontraste: proyecto vacío o existente, stack actual, estado de Git y riesgos visibles.
3. Implementa el producto siguiendo todas las fases del PRD en orden. Comienza con la **Fase 0 — Fundación**, continúa con base de datos y seguridad, y avanza por productos, inventario/POS, reportes, catálogo, Realtime y QA.
4. No te detengas después de crear el esqueleto ni después de la Fase 0. Continúa implementando y verificando cada fase mientras el entorno y el contexto lo permitan.
5. Si faltan credenciales externas de Supabase, deja la integración preparada con variables de entorno, crea las migraciones y documenta los pasos manuales. No inventes credenciales ni afirmes que probaste una conexión remota que no existe.
6. Si alcanzas un límite práctico de contexto o ejecución, detente únicamente en un checkpoint coherente: código compilable, cambios guardados, pruebas ejecutadas y documentación del estado. Indica la fase siguiente exacta para continuar.
7. Ejecuta typecheck, lint, pruebas disponibles y build después de cada bloque significativo y al final.
8. Termina con un resumen de archivos creados/modificados, funcionalidades terminadas, comandos ejecutados y resultados reales, variables o tareas manuales pendientes, riesgos restantes y el siguiente paso exacto.

**No te detengas en una propuesta visual ni en un documento de planificación: modifica el repositorio y construye CoplinTech POS de forma funcional, fase por fase, sin sacrificar la seguridad ni la integridad de ventas e inventario.**
