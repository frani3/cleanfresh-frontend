---
id: 037
type: spec
status: approved
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

⏳ Pendiente.
