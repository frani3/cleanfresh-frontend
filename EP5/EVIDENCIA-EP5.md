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
