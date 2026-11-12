# Despliegue de Kafka (EP5)

Dos composes, cada uno en su carpeta, como pide el caso (un compose por máquina):

| Carpeta | Qué levanta | Dónde corre |
|---|---|---|
| [`kafka/`](kafka/) | **Zookeeper de 3 nodos** (`zk1..3`) y **3 brokers** (`kafka1..3`), más `kafka-init`, que crea los tópicos | EC2 `cleanfresh-kafka` (y en local) |
| [`kafka-ui/`](kafka-ui/) | **Kafka-UI**, para administrar brokers, tópicos y consumer groups desde el navegador | Misma EC2 (y en local) |

## Levantar (local o en la EC2)

```bash
cd kafka
cp .env.example .env            # en AWS: KAFKA_ADVERTISED_HOST = IP privada de la EC2
docker compose up -d            # 1 a 2 minutos; al final kafka-init crea los tópicos
docker compose ps               # 3 zk y 3 kafka en "healthy"; kafka-init termina solo

cd ../kafka-ui
cp .env.example .env            # elegir KAFKA_UI_USER y KAFKA_UI_PASSWORD
docker compose up -d            # http://localhost:8090  (en AWS: http://<IP-EC2-kafka>:8090)
```

| Qué | Puerto |
|---|---|
| Broker 1, 2 y 3 (los usan los microservicios) | `9092`, `9093`, `9094` |
| Kafka-UI | `8090` |
| Zookeeper | no se publica (solo dentro de la red de Docker) |

Dentro de la red de Docker (`cleanfresh-kafka-net`, la comparten los dos composes) los brokers se llaman `kafka1:29092`, `kafka2:29092` y
`kafka3:29092`. Fuera de Docker se llega por `KAFKA_ADVERTISED_HOST:909x`.

## Tópicos

`crear-topicos.sh` (lo ejecuta `kafka-init`, se puede repetir: `docker compose run --rm kafka-init`) deja:

| Tópico | Particiones × réplicas | Política | Retención |
|---|---|---|---|
| `orders.events` | 3 × 3 | `delete` | 7 días |
| `audit.timeline` | 3 × 3 | `compact,delete` | 30 días |
| `orders.events.reportes.DLT`, `orders.events.auditoria.DLT`, `audit.timeline.auditoria.DLT` | 3 × 3 | `delete` | 14 días |

Todos con `min.insync.replicas=2`: con `acks=all`, se tolera la caída de un broker sin perder escrituras. Los tópicos no se crean solos al
publicar (`auto.create.topics.enable=false`): un nombre mal escrito falla en vez de crear un tópico fantasma.

## Comprobar

```bash
cd kafka
for z in zk1 zk2 zk3; do docker compose exec -T $z bash -c 'echo srvr | nc localhost 2181 | grep Mode'; done   # 1 leader y 2 follower
docker compose exec -T kafka1 kafka-topics --bootstrap-server kafka1:29092 --describe --topic orders.events
```

## Cosas que hay que saber

- **Memoria:** todo el clúster más Kafka-UI usa cerca de 1,8 GB (brokers ~375 MB, Zookeeper ~100 MB, Kafka-UI ~450 MB), con el heap limitado en
  el compose.
- **Tolerancia a fallos:** si se detiene un broker (`docker compose stop kafka2`), los tópicos siguen disponibles; los líderes pasan a
  los otros dos y, al volver, el broker se resincroniza. Con dos brokers caídos `acks=all` deja de aceptar escrituras (queda 1 réplica,
  menos que `min.insync.replicas`).
- **Zookeeper:** son 3 nodos para tener mayoría (tolera la caída de 1).
- `docker compose down -v` borra los volúmenes (los tópicos y sus mensajes).
- RabbitMQ no se toca: sus composes y su topología están en `EP2/despliegue/`.
