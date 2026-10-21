---
id: 035
type: spec
status: verified
---

# Spec 035 — Avisos al Cliente en cada cambio de estado y "Tus pedidos" que se actualiza solo

## Qué debe hacer

Dos problemas que se ven juntos cuando un Cliente espera su pedido:

**A. El Cliente solo recibe aviso al llegar a DESPACHADO.** Hoy `orders` publica un comando solo cuando
la orden pasa a `DESPACHADO` por primera vez ("Tu pedido ORD-0013 (Planchado) está listo"). Si el Operador la
lleva a Aceptado, En preparación, Entregado o Cancelado, el Cliente no recibe nada: en `ORD-0013` el estado
llegó a ENTREGADO y no existe ningún aviso para el cliente. Esta spec hace que el Cliente reciba **un aviso en
cada cambio de estado**.

**B. La pantalla del Cliente no se actualiza sola.** La campanita y el módulo de notificaciones consultan cada
15 s, pero **"Tus pedidos" se carga una sola vez** al entrar: el Cliente tiene que recargar la página para ver
el estado nuevo. Esta spec hace que se actualice sola.

### A. Avisos por cada cambio de estado

| Estado al que pasa | Aviso al Cliente | Tipo |
|---|---|---|
| `ACEPTADO` | "Tu pedido ORD-0013 (Planchado) fue aceptado" | `ORDEN_ESTADO` (nuevo) |
| `EN_PREPARACION` | "Tu pedido ORD-0013 (Planchado) está en preparación" | `ORDEN_ESTADO` (nuevo) |
| `DESPACHADO` | "Tu pedido ORD-0013 (Planchado) está listo" (**igual que hoy**, más la boleta) | `ORDEN_LISTA` |
| `ENTREGADO` | "Tu pedido ORD-0013 (Planchado) fue entregado" | `ORDEN_ESTADO` (nuevo) |
| `CANCELADO` | "Tu pedido ORD-0013 (Planchado) fue cancelado" | `ORDEN_ESTADO` (nuevo) |

- Se publica solo cuando el estado **realmente cambia** (repetir el mismo estado no vuelve a avisar), igual
  que hoy con DESPACHADO, y después de confirmarse en la base (si la publicación falla, el cambio queda guardado
  y se registra el error).
- Los avisos nuevos viajan por el mismo comando `email.send` (cmd.direct, o cmd.topic con la variante
  `email.send.high` para el Servicio exprés), con el mismo sobre; el estado va en el `payload`.
- **Idempotencia:** el mismo mensaje dos veces no duplica el aviso (por `eventId`). Una orden puede tener
  varios avisos de estado distintos (uno por cada estado), pero no dos del mismo estado.
- `DESPACHADO` conserva `ORDEN_LISTA`, el texto y el comando de la boleta (`invoice.gen`) tal como están.
- En el módulo de notificaciones el tipo nuevo se ve con la etiqueta **"Estado del pedido"** y el mensaje dice
  cuál es el estado ("fue aceptado", "está en preparación"...). (Se pensó una etiqueta por estado, pero el
  aviso no guarda el estado como dato aparte; una etiqueta única evita cambiar el esquema de la base.)
  El Operador **no** recibe avisos por estos cambios (los hace él). Volver a `CREADO` no genera aviso.

### B. "Tus pedidos" se actualiza solo

- **Cliente:** su lista de pedidos se vuelve a consultar **cada 15 s** (la misma cadencia de los avisos) y
  **además al instante cuando llega un aviso nuevo**, así que el estado cambia en cuanto le llega el aviso.
- **Operador:** su lista de órdenes se refresca cuando llega un aviso nuevo (un pedido nuevo de su sucursal), sin
  tener que pulsar "Actualizar".
- **Admin:** sin cambios. Sus órdenes creadas a mano en pantalla no existen en el backend y una recarga
  automática las borraría.
- La actualización no interrumpe lo que se está haciendo (no cierra ventanas abiertas ni cambia filtros) y,
  si la consulta falla, deja lo que ya había.

## Fuera de alcance

- Correo, push o sonido (se sigue consultando por intervalo).
- Avisos al Operador o al Admin por cambios de estado.
- Impedir saltos de estado (p. ej. de Creado a Entregado): hoy el Operador puede elegir cualquier estado y eso
  no cambia; ahora al menos el Cliente se entera de cada uno.
- Historial de cambios en el backend.

## Cambios por servicio

- **`ms-cleanfresh-orders`:** publicar el comando de aviso en **cada** cambio de estado (hoy solo DESPACHADO).
- **`ms-cleanfresh-notificaciones`:** aceptar el tipo `ORDEN_ESTADO`, construir su texto y evitar el duplicado
  de un mismo estado (hoy la segunda defensa es "mismo tipo y orden", que bloquearía el segundo aviso de estado).
  **Cambio de esquema:** la tabla `notificaciones` tiene una restricción única `(tipo, numero_orden)` en la base
  (de la Spec 030); impediría el segundo aviso de estado de una orden. Pasa a `(tipo, numero_orden, mensaje)` y,
  como `ddl-auto: update` no elimina restricciones, una migración al arrancar (`MigracionEsquema`, solo
  PostgreSQL, idempotente) quita la vieja de una base que ya existe, como la RDS.
- **BFF:** sin cambios (los avisos ya se listan y filtran por rol).
- **Frontend:** etiquetas del tipo nuevo, consulta periódica de órdenes del Cliente, refresco al llegar un aviso.

## Acceptance Criteria

1. Al pasar una orden a `ACEPTADO`, `EN_PREPARACION`, `ENTREGADO` o `CANCELADO`, su Cliente recibe **un** aviso con
   el texto de la tabla; al pasar a `DESPACHADO` recibe el de siempre ("está listo") y se genera la boleta.
2. Repetir el mismo estado no genera otro aviso. Pasar por varios estados genera un aviso por cada uno.
3. El mismo mensaje entregado dos veces no duplica el aviso.
4. El aviso de cada cambio le llega solo al Cliente dueño (otro Cliente y el Operador no lo ven en su lista).
5. Si falla la publicación, el cambio de estado queda guardado igual y el error se registra.
6. El tipo nuevo se muestra con su etiqueta en el módulo de notificaciones y cuenta como "sin leer".
7. El Cliente ve el estado nuevo en "Tus pedidos" **sin recargar la página**: como máximo a los 15 s, y al
   instante si ya llegó el aviso.
8. El Operador ve un pedido nuevo en su lista sin pulsar "Actualizar".
9. La actualización automática no cierra una ventana abierta ni borra un filtro o búsqueda, y no se dispara en el Admin.
10. Pruebas automáticas de `orders` y `notificaciones` en verde; build del frontend sin errores; verificado en el
    navegador con el Cliente y el Operador, y en AWS con una orden real recorriendo todos los estados
    (`verificar.sh` y `verificar-flujo.sh` siguen en "Todo OK").

## Verificación

Fases: A backend (`orders`, `notificaciones`), B frontend, C verificación en el navegador, D despliegue en AWS.
Capturas en `EP2/capturas/035/`. Salidas completas en [`EVIDENCIA-EP2.md`](../EVIDENCIA-EP2.md), sección 11.

**Backend.** `orders`: 38 pruebas (10 nuevas); `notificaciones`: 54 (9 nuevas, incluida la lectura del sobre con y sin
`estado`). Contra un **Postgres y RabbitMQ reales en local**: una orden recorrió Creado → Aceptado (dos veces) →
En preparación → Despachado → Entregado y el Cliente recibió 4 avisos (el `ACEPTADO` repetido no duplicó,
`DESPACHADO` sigue siendo "está listo"); una orden exprés saltó de Creado a Entregado y luego a Cancelado y recibió
los dos avisos; el Operador no recibió ninguno de estado.

**Hallazgo en la verificación (migración).** La tabla `notificaciones` tenía una restricción única
`(tipo, numero_orden)` en la base, de la Spec 030, que impedía el segundo aviso de estado de una orden. Las pruebas
con H2 lo mostraron (`Violación de índice de Unicidad`). Se cambió a `(tipo, numero_orden, mensaje)` y se agregó
`MigracionEsquema`, que quita la vieja al arrancar en una base que ya existe. Se probó contra el Postgres local y
corrió en la RDS (ver más abajo).

**Frontend.** Build sin errores ni advertencias; 11 pruebas de la lógica pura. Verificación en Chrome con sesión y
API simuladas (con estado), un script por rol:

| # | AC | Estado |
|---|---|---|
| 1–5 | Un aviso por cada cambio de estado (texto, repetidos, eventId, destinatario, falla de publicación) | ✅ Cumple (pruebas automáticas y recorrido real, local y AWS) |
| 6 | Etiqueta del aviso de estado | ✅ Cumple: "Estado del pedido" en el módulo del Cliente y del Admin |
| 7 | El Cliente ve el estado nuevo sin recargar | ✅ Cumple: por la consulta periódica en 9 s (≤ 15 s); al llegar un aviso, las órdenes se refrescan en los 2,5 s siguientes y "Tus pedidos" pasa a "En preparación" |
| 8 | El Operador ve un pedido nuevo sin pulsar "Actualizar" | ✅ Cumple: ORD-0014 apareció a los 7 s (llegó su aviso) |
| 9 | No interrumpe lo que se hace; el Admin no se toca | ✅ Cumple: la búsqueda escrita y la ventana de la orden abierta siguen tras el refresco; con la consulta de órdenes fallando la pantalla no se rompe y se recupera sola; el Operador sin avisos nuevos no consulta nada (0 en 31 s); el Admin no consulta las órdenes solo (0 en 33 s, aunque llegue un aviso) |
| 10 | Pruebas, build y AWS | ✅ Cumple (ver abajo) |

**AWS.** `notificaciones` y `orders` reconstruidos (primero `notificaciones`, porque la migración corre al arrancar y
el sobre nuevo es compatible hacia atrás). En la RDS la migración registró
`se eliminó la restricción única uk54jum8… de notificaciones (tipo, numero_orden)` y quedó
`UNIQUE (tipo, numero_orden, mensaje)`. Una orden real recorrió todos los estados con los 4 avisos esperados y su
boleta; la orden exprés (salto a Entregado y Cancelado) recibió sus 2 avisos; las 6 colas y DLQ quedaron en 0.
`verificar.sh` y `verificar-flujo.sh`: "Todo OK".

**Límites.** El Operador sigue pudiendo saltar estados (no se impide, a pedido). Volver a `CREADO` no avisa. Al
refrescarse la lista del Operador por un aviso nuevo se pierde el historial de cambios de esa sesión que el
frontend arma en memoria (lo mismo que pasa hoy al pulsar "Actualizar"). Falta probarlo en la app real con los
tres usuarios.
