---
id: 037
type: spec
status: verified
---

# Spec 037 — Topología de RabbitMQ como la guía del profesor (políticas de DLX y bindings del topic)

## Qué debe hacer

El profesor entregó la guía "Configuración Rabbit para caso Pedidos 360 · Parte 1". Comparada con lo que ya
estaba hecho (Spec 033), la mensajería cubre todo lo funcional, pero hay **dos diferencias de forma**. Esta spec
las alinea con la guía:

1. **Dead-lettering con políticas.** La guía crea las colas **sin argumentos** y asigna el DLX con **tres políticas**
   (`policy.email.dlx`, `policy.kitchen.dlx`, `policy.invoice.dlx`, patrón `^q\.cmd\.<flujo>$`, `dead-letter-exchange =
   cmd.dead.dlx` y `dead-letter-routing-key` = `email.send` / `kitchen.ticket` / `invoice.gen`). Hoy el DLX va como argumento
   `x-dead-letter-*` de cada cola y en el panel no aparece ninguna política de DLX.
2. **Bindings del topic como la guía** (9 bindings en total, igual que su tabla de la sección 7):

| Exchange | Cola | Binding |
|---|---|---|
| `cmd.direct` | `q.cmd.email` / `q.cmd.kitchen` / `q.cmd.invoice` | `email.send` / `kitchen.ticket` / `invoice.gen` (igual) |
| `cmd.topic` | `q.cmd.email` | `email.#` (antes `email.*` y `email.send.*`) |
| `cmd.topic` | `q.cmd.kitchen` | `kitchen.#` (igual) |
| `cmd.topic` | `q.cmd.invoice` | `invoice.#` (antes `invoice.*` y `invoice.gen.*`) |
| `cmd.dead.dlx` | las tres `.dlq` | `email.send` / `kitchen.ticket` / `invoice.gen` (igual) |

### Una adaptación sobre la guía: `invoice.#`

La guía deja `invoice.*` y advierte que "`invoice.gen.pdf` no coincidirá sin adaptar ese patrón". En este proyecto
las órdenes de **Servicio exprés** publican `invoice.gen.pdf` por `cmd.topic` (y `kitchen.ticket.thermal`,
`email.send.high`), así que con `invoice.*` esa boleta no llegaría a ninguna cola y el publicador fallaría. Se usa
`invoice.#`, que es lo mismo que la guía hizo con `email.#` ("ajuste del laboratorio").

### Una adaptación sobre la guía: alta disponibilidad

La guía usa un solo nodo. Este proyecto tiene dos nodos y una política `ha-all` que replica las colas. **En RabbitMQ solo
aplica una política por cola** (la de mayor prioridad; no se combinan). Si las tres políticas de DLX se llevaran solo el
DLX, las colas principales perderían la replicación. Por eso las tres políticas de DLX tienen **prioridad 1 y además
llevan `ha-mode: all` y `ha-sync-mode: automatic`**; `ha-all` (prioridad 0) sigue cubriendo las DLQ y cualquier otra
cola `q.cmd.*`.

### Otros cambios de esta spec

- **Administrador (`ms-cleanfresh-mq-admin`):** al crear una cola con DLQ ahora crea la cola **sin argumentos** y una
  política `policy.<nombre>.dlx` (prioridad 1, DLX + replicación); al eliminarla, elimina esa política. "Declarar la
  topología base" crea las tres políticas de la guía y `ha-all`. `GET /api/mq/topologia` muestra el DLX **efectivo** de cada
  cola (viene de la política) y el nombre de la política.
- **Archivos y scripts:** `definitions.json` (colas sin argumentos y 9 bindings), una carpeta `politicas/` (una política por
  archivo, aplicadas por `mq-init` **después** de crear las colas, como ya se hacía con `ha-all`), y las verificaciones
  (`verificar-mq.sh`, `verificar-admin.sh`, `verificar.sh`) y la documentación pasan de "11 bindings" a "9" y de "DLX por
  argumento" a "DLX por política".

## Fuera de alcance

- Cambiar la versión de RabbitMQ (la guía también usa 3.13).
- Hacer la configuración a mano desde el panel: la topología sigue cargándose por archivo y por el administrador (la guía
  describe el procedimiento manual como ejercicio; el resultado es el mismo y se puede comprobar en el panel).
- Cambiar los mensajes, consumidores o el sobre.

## Cómo se aplica en una base que ya existe

Los argumentos de una cola no se pueden cambiar con la cola creada, así que las 6 colas actuales (que tienen el DLX como
argumento) hay que **eliminar y volver a crear**. Están vacías en reposo. Se hace con los servicios en reposo: se eliminan las
colas, se vuelve a ejecutar `mq-init` y se reinicia `notificaciones` para que vuelva a engancharse.

## Acceptance Criteria

1. `definitions.json` declara las 6 colas **sin** `x-dead-letter-*` y exactamente **9 bindings** (los de la tabla).
2. Existen las políticas `policy.email.dlx`, `policy.kitchen.dlx` y `policy.invoice.dlx` con el patrón, DLX y routing key de
   la guía, y cada cola principal aparece en el panel con su política (`Policy: policy.<flujo>.dlx`) y su DLX efectivo.
3. Un mensaje rechazado sin reencolar en cada cola principal llega a **su** DLQ por `cmd.dead.dlx` (motivo `rejected` en
   `x-death`), igual que antes.
4. Las 6 colas siguen replicadas en los dos nodos (espejo sincronizado), también las principales gobernadas por la
   política de DLX.
5. Enrutamiento: `cmd.topic` entrega `email.send`, `email.send.high`, `kitchen.ticket`, `kitchen.ticket.thermal`,
   `invoice.gen` e `invoice.gen.pdf` **solo** a su cola; `cmd.direct` con una clave sin binding no llega a ninguna.
6. El administrador crea una cola con DLQ con su política (`policy.<nombre>.dlx`), la elimina junto con su política, y
   `POST /api/mq/topologia/base` deja la topología de la guía de forma idempotente (y repone lo que falte, incluidas las políticas).
7. Los servicios siguen funcionando: una orden normal y una exprés recorren sus estados con aviso, ticket y boleta, y un
   mensaje venenoso termina en su DLQ y queda registrado.
8. Pruebas automáticas del administrador en verde; verificaciones en local y en AWS en "Todo OK"; documentación actualizada.

## Verificación

Salidas en [`EVIDENCIA-EP2.md`](../EVIDENCIA-EP2.md), sección 13.

| # | AC | Estado |
|---|---|---|
| 1 | Colas sin `x-dead-letter-*` y 9 bindings | ✅ Cumple (local y AWS) |
| 2 | Políticas `policy.email/kitchen/invoice.dlx` con patrón, DLX y clave; cada cola las muestra | ✅ Cumple (local y AWS): `verificar-mq.sh` comprueba la política de cada cola, su DLX efectivo y que no quede el DLX como argumento |
| 3 | Rechazo sin reencolar llega a su DLQ (`rejected`) | ✅ Cumple (local y AWS) |
| 4 | Las 6 colas replicadas, también las gobernadas por la política de DLX | ✅ Cumple: `mq-init` creó "6 de 6 espejos" en el primer arranque local y en la migración de AWS; las 3 políticas de DLX llevan `ha-mode` |
| 5 | Enrutamiento del direct y del topic, incluidas las variantes | ✅ Cumple (local y AWS): `email.send.high`, `kitchen.ticket.thermal` e `invoice.gen.pdf` llegan solo a su cola |
| 6 | El administrador crea/elimina colas con su política y declara la base de forma idempotente | ✅ Cumple (local y AWS): `verificar-admin.sh` "Todo OK" en las dos; 53 pruebas automáticas |
| 7 | Los servicios siguen funcionando | ✅ Cumple en AWS: `verificar.sh` y `verificar-flujo.sh` "Todo OK" (orden normal y exprés, idempotencia, mensaje venenoso a la DLQ) |
| 8 | Pruebas, verificaciones y documentación | ✅ Cumple |

**Migración en AWS.** Las 6 colas (vacías) se eliminaron y `mq-init` las recreó sin argumentos con los 9 bindings y las 4 políticas
(`espejos creados: 6 de 6 colas`). Los consumidores (`notificaciones`) se reengancharon solos y luego se reemplazaron por las imágenes nuevas.

**Hallazgos de la verificación**

- **Crear una cola que ya existe pisaba su política.** Con el DLX como argumento, RabbitMQ rechazaba redeclarar una cola
  existente con otros argumentos (400). Con el DLX en una política y la cola sin argumentos, `POST /api/mq/queues/q.cmd.email` habría
  sobrescrito `policy.email.dlx` con otra routing key. Ahora el administrador responde `409` y no toca nada.
- **Solo rige una política por cola.** `ha-all` (prioridad 0) y las de DLX se pisarían; las de DLX llevan prioridad 1 y también `ha-mode`.
- **Las verificaciones de enrutamiento suponen que no hay consumidores.** Con `notificaciones` corriendo, el servicio consumió los
  mensajes de prueba de `verificar-mq.sh` y parecía que no llegaban a ninguna cola (`routed: true` pero "cayó en ninguna"); se
  repitió con el servicio detenido. Dejó 3 filas de prueba (`{"prueba":...}`) en el registro de mensajes muertos.

**Límites.** `invoice.#` en vez del `invoice.*` de la guía (adaptación explicada arriba). La guía también usa RabbitMQ 3.13.
