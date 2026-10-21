---
id: 039
type: spec
status: verified
---

# Spec 039 — El tipo de notificación visible en la consola de RabbitMQ

## Qué debe hacer

Para la demostración hay que poder ver, **en la consola de RabbitMQ**, qué tipo de notificación viaja en cada mensaje. Hasta ahora
el tipo (`ORDEN_CREADA`, `ORDEN_LISTA`, `ORDEN_ESTADO`) solo estaba dentro del JSON del cuerpo; en el panel, en **Queues → cola →
Get messages**, hay que abrir y leer el cuerpo para saberlo.

`orders` pasa a poner el tipo como **propiedad AMQP `type`** del mensaje y agrega dos cabeceras, de modo que el panel lo muestra
en **Properties** sin abrir el JSON:

| Dato | Dónde se ve en la consola | Valores |
|---|---|---|
| Tipo de notificación | Properties → `type` | `ORDEN_CREADA` (pedido nuevo), `ORDEN_LISTA` (pedido despachado), `ORDEN_ESTADO` (otro cambio de estado) |
| A quién va | Properties → headers → `destinatario` | `SUCURSAL` (aviso al Operador por un pedido nuevo), `CLIENTE` (aviso por cambio de estado, y boleta), `TALLER` (ticket de taller) |
| Estado de la orden | Properties → headers → `estado` | `CREADO`, `ACEPTADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `CANCELADO` |
| Orden | Properties → `correlation_id` y la clave de ruteo | `ORD-0014`, `email.send` / `kitchen.ticket` / `invoice.gen` (o su variante) |

El cuerpo (el sobre JSON), las colas, los consumidores y el comportamiento de los avisos **no cambian**; solo se agregan metadatos.

`demo-notificaciones.sh` muestra además, en los pasos con el servicio caído, el tipo de cada mensaje que espera en la cola (lo mismo que
enseña el panel) y comprueba que el aviso al Operador es `ORDEN_CREADA/SUCURSAL` y el cambio de estado, `ORDEN_ESTADO/CLIENTE`.

## Fuera de alcance

- Cambiar el JSON, las claves de ruteo o lo que hace `notificaciones` con cada tipo.
- Mostrar el tipo en la app (ya se ve en el módulo de notificaciones como "Pedido nuevo", "Pedido listo", "Estado del pedido").

## Acceptance Criteria

1. Cada mensaje que publica `orders` lleva `type` igual al tipo del JSON y las cabeceras `destinatario` y `estado`.
2. `destinatario` es `SUCURSAL` para el aviso de un pedido nuevo, `CLIENTE` para los avisos por despacho o cambio de estado y para la boleta, y
   `TALLER` para el ticket; también en las órdenes exprés.
3. En la consola de RabbitMQ, **Get messages** de una cola con mensajes muestra esas propiedades (verificado contra el clúster de AWS).
4. Los servicios siguen funcionando igual: `verificar.sh`, `verificar-flujo.sh` y `demo-notificaciones.sh` en "Todo OK".
5. Pruebas de `orders` en verde y guion de la demostración actualizado.

## Verificación

Salidas en [`EVIDENCIA-EP2.md`](../EVIDENCIA-EP2.md), sección 15.

| # | AC | Estado |
|---|---|---|
| 1 | `type` igual al del JSON y cabeceras `destinatario` y `estado` | ✅ Cumple: 5 pruebas nuevas de `orders` (48 en total), incluida la variante exprés |
| 2 | `destinatario`: SUCURSAL / CLIENTE / TALLER según el comando | ✅ Cumple (prueba de la regla y mensajes reales en AWS) |
| 3 | La consola muestra esas propiedades en Get messages | ✅ Cumple en AWS (API del panel): `type: ORDEN_CREADA`, `destinatario: SUCURSAL` en `q.cmd.email`; `destinatario: TALLER` en `q.cmd.kitchen` |
| 4 | Los servicios siguen igual | ✅ Cumple: `verificar.sh`, `verificar-flujo.sh` y `demo-notificaciones.sh` "Todo OK" |
| 5 | Pruebas y guion | ✅ Cumple (guía, sección 5.9) |

**Detalle.** En Get messages también aparecen cabeceras `spring_returned_message_correlation` y `spring_listener_return_correlation`: las agrega
Spring AMQP para seguir los mensajes devueltos por el broker (*publisher returns*) y no son del proyecto. `type` es una propiedad AMQP estándar,
distinta del campo `type` del JSON, pero con el mismo valor.
