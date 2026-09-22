---
id: 020
type: spec
status: draft
---

# Spec 020 — Historial de estados por orden + Cliente conectado a órdenes reales

## Qué debe hacer

**a) Confirmación al avanzar estado (Operador):** el botón "avanzar al
siguiente estado" que ya existe en "Gestión de órdenes" pasa a pedir
confirmación antes de aplicar el cambio (hoy lo hace sin preguntar).

**b) Modal de línea de tiempo por orden (nuevo, `OrderLifecycleModal`):**
se agrega un botón "Ver" por orden, tanto en Operador como en Cliente,
que abre un modal con:
- Datos de la orden (N°, cliente, sucursal, servicio, precio).
- Una línea de tiempo visual del flujo de estados (mismo estilo que ya
  usa hoy "Mis pedidos" de Cliente: pasos con check).
- Un historial debajo: quién hizo cada cambio de estado y cuándo
  (nombre/email de la sesión que lo hizo, más un "Estado inicial" para
  lo que ya traía la orden al cargarse del backend).
- **Solo para Operador**: un selector de estado (los 5 valores, no solo
  "avanzar") + botón "Confirmar cambio" con su propia confirmación. Para
  Cliente, el modal es de solo lectura (sin selector ni botón de
  cambio).

**c) Cliente conectado a órdenes reales:** "Mis pedidos" deja de usar el
mock `CLIENT_ORDERS` y pasa a mostrar las órdenes reales del BFF (mismas
que ya usan Admin/Operador). **Importante** (ver nota más abajo): al no
existir todavía un vínculo real cliente↔orden en el backend, esto
muestra **todas** las órdenes, no filtradas por cliente — se renombra la
tarjeta para no prometer algo que no hace.

## Nota de alcance (decisión consciente, no bug)

No existe en el backend ningún campo que vincule una orden con la
cuenta de Azure del cliente que la hizo (`OrderResponse.cliente` es un
nombre de texto libre, no un email/ID). Por eso, conectar a Cliente
significa por ahora mostrarle **todas** las órdenes, igual que ve
Catálogo hoy. Cuando exista ese vínculo real (requeriría cambios en
`ms-orders` y en cómo se crean las órdenes), esto se puede filtrar de
verdad.

## Modelo de datos

Cada orden agrega `history: [{ status, actor, timestamp }]`. Al llegar
del backend (`getOrders()`), se siembra con una sola entrada
`{ status: <estado actual>, actor: "Sistema", timestamp: <fecha> }`.
Cada cambio de estado posterior (desde cualquier vista: Admin,
Operador) agrega una entrada nueva con el actor de la sesión que lo
hizo.

## Acceptance Criteria

1. El botón "avanzar al siguiente estado" en Operador pide confirmación
   antes de aplicar el cambio; si se cancela, no cambia nada.
2. Hay un botón "Ver" por orden en Operador y en Cliente que abre
   `OrderLifecycleModal` con los datos de esa orden.
3. El modal muestra la línea de tiempo visual del flujo de estados
   (mismo componente/estilo que ya usaba "Mis pedidos").
4. El modal muestra el historial de cambios: estado, quién lo hizo
   (nombre/email real de la sesión que lo aplicó) y cuándo.
5. Para Operador, el modal tiene un selector con los 5 estados (no solo
   "el siguiente") y un botón para confirmar el cambio, con su propia
   confirmación explícita antes de aplicarlo.
6. Para Cliente, el modal no tiene forma de cambiar el estado (solo
   lectura).
7. Cualquier cambio de estado — desde el botón rápido de Operador, desde
   el selector del modal, o desde el modal "Ver/Editar" que ya tiene
   Admin (Spec 004) — agrega una entrada al historial de esa orden con
   el actor real de la sesión.
8. "Mis pedidos" de Cliente usa las órdenes reales del BFF (ya cargadas
   para el resto de los roles), no el mock `CLIENT_ORDERS` (que se
   elimina).
9. El título/subtítulo de esa tarjeta en Cliente deja en claro que
   todavía no filtra por cliente (ver nota de alcance).
10. Nada de esto rompe el CRUD ni las specs anteriores de Admin/Operador.
