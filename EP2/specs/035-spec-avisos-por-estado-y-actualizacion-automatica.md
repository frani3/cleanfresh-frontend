---
id: 035
type: spec
status: approved
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

⏳ Pendiente de aprobación.
