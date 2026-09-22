---
id: 024
type: spec
status: verified
---

# Spec 024 — Cliente ve solo sus propios pedidos + puede solicitar servicios

## Qué debe hacer

a) Se habilita el botón "Solicitar" del catálogo (Cliente): abre
`RequestServiceModal`, que pide la sucursal (limitado a las sucursales
donde ese servicio está disponible) y crea una orden nueva — mismo
patrón client-side que ya usa el resto del CRUD (`addOrder`) — con
`cliente` = nombre/email de la cuenta logueada (`actor`, el mismo que
ya usa el historial de Spec 020).

b) "Pedidos" en Cliente (renombrada "Tus pedidos") pasa a mostrar solo
las órdenes cuyo campo `cliente` coincide con el nombre/email de la
cuenta logueada (comparación exacta, case-insensitive). Como los
pedidos mock del backend no tienen ningún nombre que coincida con
cuentas reales, un Cliente recién logueado empieza con la lista vacía
hasta que solicita su primer servicio — es el comportamiento esperado.

c) Se actualiza el subtítulo/estado vacío de la tarjeta.

## Nota de alcance

Sigue sin existir en el backend un vínculo real cuenta Azure↔orden
(ver Spec 020). Esto filtra correctamente los pedidos creados desde
esta misma sesión (coinciden exacto con `actor`), pero **no** puede
recuperar retroactivamente pedidos mock preexistentes como propios de
ningún usuario real — eso seguirá requiriendo un cambio de backend
(`ms-orders` + cómo se crean las órdenes) para asociarlas a un ID de
cuenta real en vez de un nombre de texto libre.

## Acceptance Criteria

1. El botón "Solicitar" de cada servicio disponible abre un modal para
   elegir sucursal (solo las sucursales donde ese servicio está
   disponible).
2. Al confirmar, se crea una orden nueva con estado `CREADO`,
   `cliente` = nombre/email de la sesión, servicio y precio del
   servicio elegido, y la sucursal seleccionada.
3. La orden nueva aparece de inmediato en "Tus pedidos" (Cliente) y en
   las vistas de Operador/Admin (mismo estado `orders` compartido).
4. "Tus pedidos" (Cliente) solo muestra órdenes cuyo `cliente`
   coincide (case-insensitive) con el nombre/email de la cuenta
   logueada.
5. El subtítulo de la tarjeta ya no dice "sin filtrar por cliente".
6. Si el Cliente no tiene pedidos propios todavía, se muestra un
   estado vacío que invita a solicitar uno.
7. No rompe el CRUD ni las specs anteriores (Admin/Operador siguen
   viendo todas las órdenes sin filtrar).

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | `RequestServiceModal` filtra `BRANCHES` por `service.branches[b]` | ✅ Cumple |
| 2 | `onCreate` arma `{ branch, service, price, status: "CREADO", createdAt }`, `customer` se agrega en `ClienteView` como `actor` | ✅ Cumple |
| 3 | `onRequestOrder={addOrder}` reutiliza el mismo `setOrders` compartido con Admin/Operador | ✅ Cumple |
| 4 | `myOrders` filtra `o.customer.trim().toLowerCase() === normalizedActor` | ✅ Cumple |
| 5 | Título/subtítulo cambiado a "Tus pedidos" / "Solo tus órdenes" | ✅ Cumple |
| 6 | Estado vacío: "Todavía no tienes pedidos. Solicita uno desde el catálogo." | ✅ Cumple |
| 7 | Lint y `npm run build` sin errores; `AdminView`/`OperadorView` siguen recibiendo `orders` sin filtrar | ✅ Cumple |

Verificado por lectura de código + build; pendiente de confirmación
visual en navegador (login real como Cliente: solicitar un servicio y
ver que aparece filtrado, y que Admin/Operador lo ven también).
