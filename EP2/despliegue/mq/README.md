# Clúster RabbitMQ (Spec 033)

Clúster de dos nodos (`rabbit1` y `rabbit2`) con el panel de administración y la topología de la guía del
profesor (Spec 037). En AWS va en su propia EC2 (`ec2-mq`); aquí también se puede levantar en local.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.yml` | Los dos nodos, el servicio `mq-init` que carga la topología y los volúmenes |
| `join-cluster.sh` | Arranque de `rabbit2`: la primera vez se une a `rabbit1`; después arranca normal |
| `definitions.json` | Exchanges, colas (sin argumentos) y los 9 bindings |
| `politicas/` | Una política por archivo (el nombre del archivo es el de la política): `policy.email.dlx`, `policy.kitchen.dlx` y `policy.invoice.dlx` (dead-lettering, como la guía) y `ha-all` (replica las colas `q.cmd.*` en los dos nodos) |
| `.env.example` | Variables (`RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_ERLANG_COOKIE`); copiar a `.env` |
| `verificar-mq.sh` | Comprueba nodos, topología, espejos, enrutamiento y redirección a las DLQ |
| `demo-nodo-caido.sh` | Detiene un nodo, comprueba que el sistema sigue y que nada se pierde al reiniciar |

## Levantar

```bash
cp .env.example .env      # completar usuario, clave y cookie (la cookie debe ser la misma en los dos nodos)
docker compose up -d      # tarda 1 a 2 minutos: rabbit2 se une al clúster y mq-init carga la topología
./verificar-mq.sh         # debe terminar en "Todo OK"
```

| Qué | Dónde |
|---|---|
| AMQP | `rabbit1` en `:5672`, `rabbit2` en `:5673` |
| Panel de administración | `http://<host>:15672` (rabbit1) y `:15673` (rabbit2), con el usuario del `.env` |

## Topología

3 flujos, cada uno con su cola y su cola de mensajes fallidos (DLQ):

| Cola | DLQ | Propósito |
|---|---|---|
| `q.cmd.email` | `q.cmd.email.dlq` | Avisos al Operador y al Cliente |
| `q.cmd.kitchen` | `q.cmd.kitchen.dlq` | Ticket de taller |
| `q.cmd.invoice` | `q.cmd.invoice.dlq` | Boleta |

Exchanges: `cmd.direct` (direct), `cmd.topic` (topic) y `cmd.dead.dlx` (direct, el de las DLQ).

Las colas se crean **sin argumentos** y el dead-lettering lo dan **tres políticas**, como en la guía del profesor
(sección 6.2). Cada una apunta exactamente a su cola con un patrón anclado:

| Política | Patrón | `dead-letter-exchange` | `dead-letter-routing-key` |
|---|---|---|---|
| `policy.email.dlx` | `^q\.cmd\.email$` | `cmd.dead.dlx` | `email.send` |
| `policy.kitchen.dlx` | `^q\.cmd\.kitchen$` | `cmd.dead.dlx` | `kitchen.ticket` |
| `policy.invoice.dlx` | `^q\.cmd\.invoice$` | `cmd.dead.dlx` | `invoice.gen` |

Un mensaje rechazado sin reencolar va a su DLQ por `cmd.dead.dlx`, y en el panel cada cola principal muestra su
política (`Policy: policy.email.dlx`...).

Los 9 bindings (igual que la tabla de la sección 7 de la guía):

| Exchange | Cola | Binding |
|---|---|---|
| `cmd.direct` | `q.cmd.email` / `q.cmd.kitchen` / `q.cmd.invoice` | `email.send` / `kitchen.ticket` / `invoice.gen` |
| `cmd.topic` | `q.cmd.email` | `email.#` |
| `cmd.topic` | `q.cmd.kitchen` | `kitchen.#` |
| `cmd.topic` | `q.cmd.invoice` | `invoice.#` |
| `cmd.dead.dlx` | `q.cmd.email.dlq` / `q.cmd.kitchen.dlq` / `q.cmd.invoice.dlq` | `email.send` / `kitchen.ticket` / `invoice.gen` |

La guía deja `invoice.*` y avisa que `invoice.gen.pdf` no casará "sin adaptar ese patrón". Aquí las órdenes de Servicio
exprés publican `invoice.gen.pdf` (y `email.send.high`, `kitchen.ticket.thermal`) por `cmd.topic`, así que `invoice` va con
`#`, igual que la guía hizo con `email.#`. En `#` casan cero o más palabras; en `*`, exactamente una.

## Cosas que hay que saber

- **Las políticas se aplican después de crear las colas** (lo hace `mq-init`, leyendo `politicas/`).
  Si la de alta disponibilidad viene dentro de `definitions.json`, queda registrada pero RabbitMQ no crea
  los espejos en el otro nodo, y si cae el nodo de la cola se pierde su contenido. `verificar-mq.sh`
  comprueba que cada cola tenga un espejo sincronizado.
- **En RabbitMQ solo rige una política por cola** (la de mayor prioridad; no se combinan). Las tres de
  dead-lettering tienen prioridad 1 y llevan además `ha-mode: all` y `ha-sync-mode: automatic`, así las
  colas principales no pierden la replicación de `ha-all` (prioridad 0, que cubre las DLQ). La guía usa un
  solo nodo y no necesita esto.
- **Migrar una base que ya tenía las colas con el DLX como argumento** (diseño anterior): los argumentos de una
  cola no se pueden cambiar con la cola creada, así que hay que eliminar las 6 colas (están vacías en reposo) y
  volver a ejecutar `docker compose run --rm mq-init`; después reiniciar `notificaciones`.
- Las colas espejo son una función **obsoleta** en RabbitMQ 3.13 (se quita en 4.0), por eso la
  imagen está fijada en `3.13`. Con dos nodos no sirven las colas "quorum" (necesitan mayoría).
- `mq-init` se puede repetir sin efectos: `docker compose run --rm mq-init`.
- `docker compose down -v` borra los volúmenes (las colas y los mensajes).
