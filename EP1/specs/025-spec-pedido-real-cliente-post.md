---
id: 025
type: spec
status: verified
---

# Spec 025 — Pedido real: Cliente crea la orden en el backend (POST), visible para Operador/Admin

## Qué debe hacer

**a) POST real en `ms-cleanfresh-orders`:** nuevo endpoint `POST /api/orders`
que recibe `{ cliente, servicio, total, sucursal }`, genera
`numeroOrden`/`id`/`fecha` server-side, arranca en estado `CREADO`, y lo
agrega a la lista en memoria (mismo patrón mock que ya usan los otros
dos servicios — sigue sin haber DB cloud, eso sigue pendiente y fuera
de este alcance).

**b) POST en el BFF:** `POST /api/orders`, `@PreAuthorize("hasAnyRole('Cliente', 'Admin')")`,
reenvía a `ms-cleanfresh-orders`. El campo `cliente` no viene del body
del frontend — el BFF lo resuelve del claim `name` (o
`preferred_username` como fallback) del JWT, para no confiar en que el
frontend diga de quién es la orden.

**c) Frontend:** el modal "Solicitar" del Cliente (Spec 024) deja de
usar `addOrder` (client-side puro) y pasa a llamar a `createOrder()`
(POST real vía el BFF); la orden creada por el backend se agrega al
estado local. Se agrega un botón "Actualizar" en "Gestión de órdenes"
(Operador) y "Órdenes recientes" (Admin) que vuelve a pedir
`GET /orders` a demanda, para ver pedidos creados desde otra sesión sin
tener que recargar toda la página.

## Fuera de alcance (sin cambios)

"Nueva orden"/editar/eliminar de Admin y el cambio de estado de
Operador/Admin siguen siendo client-side mock, igual que hoy — este
spec solo hace real el camino de creación desde Cliente, que es el que
se pidió para demostrar conexión real entre roles/sesiones distintas.

## Acceptance Criteria

1. `POST /api/orders` en `ms-cleanfresh-orders` crea y devuelve la
   orden con estado `CREADO`, `numeroOrden`/`id`/`fecha` generados
   server-side.
2. `POST /api/orders` en el BFF exige rol Cliente o Admin, y fuerza
   `cliente` desde el JWT (ignora lo que mande el body).
3. El modal "Solicitar" (Cliente) crea la orden vía este POST; si
   falla, muestra un error y no la agrega localmente.
4. La orden creada se ve de inmediato en "Tus pedidos" (Cliente, misma
   sesión).
5. Un botón "Actualizar" en "Gestión de órdenes" (Operador) y
   "Órdenes recientes" (Admin) vuelve a pedir las órdenes al BFF;
   después de usarlo, la orden creada por Cliente aparece ahí (sesión
   distinta, mismo backend).
6. El Cliente puede elegir entre las distintas sucursales donde el
   servicio está disponible al solicitar (Spec 024, se confirma que
   sigue intacto).
7. No rompe el resto del CRUD ni las specs anteriores.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | Probado en vivo con curl/`Invoke-RestMethod` directo a `ms-cleanfresh-orders`: `POST` crea `ORD-0007` con `estado: CREADO`, `fecha` de hoy, y el `GET` posterior confirma que quedó persistida (6→7 órdenes) | ✅ Cumple |
| 2 | Probado en vivo: `POST /api/orders` en el BFF sin token y con token inválido devuelve `401` en ambos casos; `@PreAuthorize("hasAnyRole('Cliente','Admin')")` + `nombreDesdeToken()` revisados por código | ✅ Cumple |
| 3 | `RequestServiceModal` hace `await onCreate(...)` dentro de try/catch, muestra `error` y no cierra el modal ni toca el estado local si falla | ✅ Cumple |
| 4 | `requestOrder` hace `setOrders((prev) => [created, ...prev])` tras el POST exitoso | ✅ Cumple |
| 5 | Botón "Actualizar" agregado en ambas vistas, llama a `fetchOrders` (memoizado con `useCallback`, mismo GET que ya usa el efecto inicial) | ✅ Cumple |
| 6 | `RequestServiceModal` sigue filtrando `BRANCHES` por `service.branches[b]` (Spec 024, sin cambios) | ✅ Cumple |
| 7 | Lint y `npm run build` sin errores; los 3 servicios Java compilan (`mvnw compile`); `addOrder`/`updateOrder`/CRUD de Admin sin tocar | ✅ Cumple |

Los 3 backends compilan y el flujo se probó en vivo (POST directo a
`ms-orders`, y 401 contra el BFF sin/ con token inválido). Lo único que
no pude probar acá es el flujo end-to-end con un login real de Azure
(Cliente solicitando desde el navegador y Operador viéndolo tras
apretar "Actualizar") — eso lo tenés que confirmar vos en el navegador.
