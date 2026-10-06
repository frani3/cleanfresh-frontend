---
id: 017
type: spec
status: verified
---

# Spec 017 — Conectar el frontend a catálogo y órdenes reales (GET)

## Qué debe hacer

`BentoDashboard.jsx` deja de sembrar `services`/`orders` con
`SEED_SERVICES`/`INITIAL_ORDERS` (constantes fijas) y pasa a cargarlos
del BFF real (`GET /api/catalog`, `GET /api/orders`) al entrar, usando
el interceptor ya armado en la Spec 013.

El **CRUD sigue siendo 100% local** (según lo acordado: esta ronda es
"solo lectura" del lado del backend): crear/editar/eliminar/desactivar
un servicio u orden sigue mutando el estado de React en memoria — no
hay `POST`/`PUT`/`DELETE` al BFF. La diferencia es de dónde sale el
**dato inicial**: antes mock fijo, ahora datos reales de los
microservicios.

`ClienteView` no cambia: sigue usando su propio mock `CLIENT_ORDERS`
("Mis pedidos"), no consume la lista real de `orders` — eso es un
problema distinto (filtrar por cliente) que quedó explícitamente fuera
de este trabajo.

## Acceptance Criteria

1. `apiService.js` agrega `getCatalog()` y `getOrders()`, sin recibir
   `instance`/`account` (mismo patrón que `getHealth()`).
2. `getCatalog()` transforma la respuesta del BFF (`nombre`, `precio`,
   `duracionHoras`, `sucursales`) a la forma que ya espera el resto del
   código (`name`, `price`, `eta` como texto con "h", `branches`) — así
   no hay que tocar `ServiceFormModal`, `ServiceCard`, etc.
3. `getOrders()` transforma la respuesta del BFF (`numeroOrden`,
   `cliente`, `servicio`, `estado`, `fecha`, `total`, `sucursal`) a la
   forma que ya espera el resto del código (`id` = `numeroOrden`,
   `customer`, `service`, `status`, `createdAt`, `price`, `branch`).
4. Al entrar a la vista Admin u Operador, se ve un estado de carga
   mientras se piden catálogo (y órdenes, si el rol corresponde) — no
   una tabla vacía momentánea.
5. Si `getCatalog()` u `getOrders()` fallan, se muestra un mensaje de
   error en vez de quedar cargando para siempre o mostrar una lista
   vacía sin explicación.
6. Una vez cargados, el CRUD de catálogo (Specs 001, 002, 010) y de
   órdenes (Spec 004) sigue funcionando exactamente igual que antes,
   ahora partiendo de los datos reales en vez del mock fijo.
7. `ClienteView` no pide `orders` al BFF (solo `services`, que sí
   comparte con Admin/Operador).
8. `SEED_SERVICES` e `INITIAL_ORDERS` se eliminan del código (ya no se
   usan ni como semilla ni como fallback silencioso).

## Limitación conocida (no se resuelve en esta spec)

El `duracionHoras` real de `ms-catalog` (ej. `2.0`, `1.0`) no siempre
coincide con las opciones fijas del selector de tiempo de entrega
(`ETA_OPTIONS`, Spec 002: 4h/12h/24h/48h/72h). Un servicio real con
`duracionHoras: 2` se va a **mostrar** como "2h" en las listas, pero si
un Admin lo **edita**, el selector va a mostrar la primera opción válida
(4h) en vez de "2h" al no encontrar coincidencia exacta — mismo
comportamiento que ya tenía el formulario con cualquier valor fuera de
la lista. Como el CRUD sigue sin persistir al backend, el impacto es
bajo (se resetea al recargar la página).
