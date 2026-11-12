# Evidencia EP5 — Kafka

Salidas reales de las verificaciones, en el orden de las fases de la [Spec 044](specs/044-spec-kafka-eventos-y-analitica.md).

## 1. Clúster Kafka y Kafka-UI en local (fase 2: ACs 1, 2 y 3)

Docker Desktop en el PC del autor, `docker compose up -d` en `EP5/despliegue/kafka/` y en `EP5/despliegue/kafka-ui/`.

**Contenedores** (`docker compose ps`): los 3 Zookeeper y los 3 brokers en `healthy`; `kafka-init` termina solo.

```
kafka1 Up 19 seconds (healthy)      zk1 Up 25 seconds (healthy)
kafka2 Up 19 seconds (healthy)      zk2 Up 25 seconds (healthy)
kafka3 Up 19 seconds (healthy)      zk3 Up 25 seconds (healthy)
```

**Zookeeper: un líder y dos seguidores** (`echo srvr | nc localhost 2181 | grep Mode`):

```
zk1: Mode: follower
zk2: Mode: follower
zk3: Mode: leader
```

**Brokers del clúster** (`kafka-broker-api-versions`): `kafka1:29092 (id: 1)`, `kafka2:29092 (id: 2)` y `kafka3:29092 (id: 3)`.

**Tópicos** (`kafka-topics --describe`): 3 particiones y 3 réplicas, con los 3 brokers en el ISR de cada partición.

```
orders.events   PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2,cleanup.policy=delete,retention.ms=604800000,...
  Partition: 0  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1
  Partition: 1  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2
  Partition: 2  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3

audit.timeline  PartitionCount: 3  ReplicationFactor: 3  Configs: min.insync.replicas=2,cleanup.policy=compact,delete,retention.ms=2592000000,
                min.cleanable.dirty.ratio=0.1,delete.retention.ms=86400000,segment.ms=3600000,...

orders.events.reportes.DLT  PartitionCount: 3  ReplicationFactor: 3  Configs: ...cleanup.policy=delete,retention.ms=1209600000,...
```

Los otros dos DLT (`orders.events.auditoria.DLT` y `audit.timeline.auditoria.DLT`) se crean igual. Repetir `kafka-init` no cambia nada ("existe ...: se
corrigen sus configuraciones").

**Kafka-UI** (API de la interfaz, con la sesión iniciada con el usuario del `.env`):

```
cleanfresh  status= online  brokers= 3  topics= 5  partitions= 15
crear topico desde la UI: HTTP 200     detalle: prueba.ui particiones= 3 replicas= 3     borrar: HTTP 200
```

**Memoria** (`docker stats`): brokers 375, 375 y 348 MiB; Zookeeper 98, 102 y 106 MiB; Kafka-UI 446 MiB. Total cercano a 1,8 GB.

Nota: el primer `kafka-init` falló porque `kafka-topics` no acepta varias configuraciones en un solo `--config`; se corrigió creando el tópico sin ellas y
aplicándolas con `kafka-configs` (el script quedó repetible).

## 2. Administrador de Kafka y su ruta en el BFF (fase 3: AC 9)

`ms-cleanfresh-kafka-admin` (:8087, Spring Boot 4.1.1 con `kafka-clients` 4.2.1) contra el clúster local de la sección 1 (brokers 3.6). Se probó cada
operación con `curl` sobre el servicio levantado. Códigos y salidas reales:

**Lectura:** `GET /cluster` (id, controlador 1 y los 3 brokers), `GET /topics` (los 5 tópicos con su política y retención) y `GET /topics/orders.events`:

```
orders.events {'cleanup.policy': 'delete', 'min.insync.replicas': '2', 'retention.ms': '604800000'}
 p 0 lider 2 replicas [1, 2, 3] isr [1, 2, 3]     p 1 lider 3 ...     p 2 lider 1 ...
GET /metricas -> alerta False, particiones sub-replicadas 0, DLT con mensajes []
```

**Tópicos (crear, modificar, particiones, eliminar):**

```
crear prueba.admin (3x3 con config):  200  {"accion":"tópico creado","detalle":["prueba.admin: 3 particiones, 3 réplicas"]}
crear de nuevo:                       409  {"detail":"El tópico ya existe", ...}
modificar retention.ms (SET):         200   -> {'cleanup.policy': 'delete', 'retention.ms': '7200000'}
restablecer retention.ms:             200   -> {'cleanup.policy': 'delete'}
cleanup.policy=nada:                  400  Solicitud inválida: Invalid config value ... Invalid value nada for configuration cleanup.policy
subir a 5 particiones:                200  prueba.admin: 3 -> 5
bajar a 2:                            400  Solo se pueden aumentar las particiones: prueba.admin tiene 5 y se pidió 2
tópico inexistente:                   404
eliminar orders.events (base) sin force: 409  orders.events es un tópico base del sistema; para eliminarlo hay que indicar force=true
eliminar prueba.admin:                200
POST /topologia/base:                 200  (idempotente: "existe ...: configuración corregida" por cada tópico; crea el que falte)
```

**Consumer groups** con un consumidor real (`kafka-console-consumer`, 9 mensajes en `orders.events`, el grupo `demo-grupo` leyó 6):

```
GET /groups                -> [{"id":"demo-grupo","estado":"Empty","miembros":0}]
GET /groups/demo-grupo     -> estado Empty, lagTotal 3: orders.events-0 confirmado 4 final 4 lag 0 | -1 2/2 lag 0 | -2 0/3 lag 3
reset a earliest           -> lagTotal 9 [(0,0,4),(1,0,2),(2,0,3)]
reset a latest             -> lagTotal 0
reset a offset 1           -> lagTotal 6
destino inválido           -> 400          grupo inexistente -> 404
grupo-vivo (consumidor activo): estado Stable, asignador range, coordinador broker 3,
   miembro console-consumer /172.21.0.6 ['orders.events-0', 'orders.events-1', 'orders.events-2']
   eliminar con miembro activo -> 409      eliminar grupo vacío -> 200
```

Al terminar se eliminó y recreó `orders.events` (con `force=true` y `POST /topologia/base`) para dejarlo sin los mensajes de prueba.

**Pruebas automáticas:** `ms-cleanfresh-kafka-admin`: 36 en verde (servicio con `Admin` simulado: valores por defecto 3×3, `SET` y `DELETE` de configuraciones,
no reducir particiones, tópico base protegido, base idempotente, lag, grupo inexistente, validación de offsets, métricas con alerta, timeout a 503 y errores
de la solicitud tal cual; controlador: 409, 404, 400 y 503; propiedades). BFF: 78 en verde, 11 nuevas (`KafkaAdminRoutesTests`): sin token 401, Operador y
Cliente 403 en lectura y escritura (GET, POST, PUT y DELETE), Admin reenvía y devuelve el código del administrador tal cual, rutas ajenas 404 y el
repositorio responde 503 si el administrador no responde.
