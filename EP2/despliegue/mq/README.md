# Clúster RabbitMQ (Spec 033)

Clúster de dos nodos (`rabbit1` y `rabbit2`) con el panel de administración y la topología del
enunciado. En AWS va en su propia EC2 (`ec2-mq`); aquí también se puede levantar en local.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.yml` | Los dos nodos, el servicio `mq-init` que carga la topología y los volúmenes |
| `join-cluster.sh` | Arranque de `rabbit2`: la primera vez se une a `rabbit1`; después arranca normal |
| `definitions.json` | Exchanges, colas (con su DLX) y bindings |
| `politica-ha.json` | Política que replica las colas `q.cmd.*` en los dos nodos |
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
Cada cola principal declara `x-dead-letter-exchange = cmd.dead.dlx` y su clave de DLQ, así que un
mensaje rechazado sin reencolar va a su DLQ por ese exchange.

Bindings de `cmd.topic`: además de los del enunciado (`email.*`, `kitchen.#`, `invoice.*`) hay dos
más, `email.send.*` e `invoice.gen.*`. En RabbitMQ el `*` casa **una sola palabra**, así que
`email.*` casa `email.send` pero no `email.send.high`, que es uno de los ejemplos del enunciado;
con el binding extra la variante sí llega a la cola.

## Cosas que hay que saber

- **La política de alta disponibilidad se aplica después de crear las colas** (lo hace `mq-init`).
  Si viene dentro de `definitions.json`, la política queda registrada pero RabbitMQ no crea los
  espejos en el otro nodo, y si cae el nodo de la cola se pierde su contenido. `verificar-mq.sh`
  comprueba que cada cola tenga un espejo sincronizado.
- Las colas espejo son una función **obsoleta** en RabbitMQ 3.13 (se quita en 4.0), por eso la
  imagen está fijada en `3.13`. Con dos nodos no sirven las colas "quorum" (necesitan mayoría).
- `mq-init` se puede repetir sin efectos: `docker compose run --rm mq-init`.
- `docker compose down -v` borra los volúmenes (las colas y los mensajes).
