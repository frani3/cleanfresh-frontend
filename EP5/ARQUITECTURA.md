# Arquitectura con Kafka (EP5)

Estado: **implementada y verificada en local** (Specs 044 a 046); despliegue en AWS preparado ([`despliegue/AWS.md`](despliegue/AWS.md), Spec 047). Parte de la arquitectura de EP2
([`../EP2/ARQUITECTURA.md`](../EP2/ARQUITECTURA.md)), que no cambia: se suma Kafka sin tocar RabbitMQ.

## Diagrama

```
                    ┌──────────────────────────────┐
                    │   AWS Cognito (User Pool)    │
                    └───────▲──────────────┬───────┘
                login       │              │ valida el JWT
┌────────────────┐          │              │
│ Frontend React │──────────┘              │
│ localhost:3000 │                         │
└───────┬────────┘                         │
        │ Bearer access_token              │
        ▼                                  │
┌────────────────┐   JWT Authorizer        │
│ API Gateway    │   (Cognito)             │
└───────┬────────┘                         │
        ▼                                  │
┌────────────────────────┐                 │
│ EC2 #1 · BFF :8080     │◄────────────────┘     @PreAuthorize por rol; manda X-Actor y X-Origen a orders
└───────┬────────────────┘
        │ HTTP (IP privada)
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EC2 #2 · microservicios (docker compose)                                    │
│                                                                             │
│  orders :8081 ─┬─ comandos ──► RabbitMQ (EC2 #3) ──► notificaciones :8083   │
│                │   (qué hay que hacer: aviso, ticket, boleta)               │
│                │                                                            │
│                └─ eventos ───► Kafka (EC2 cleanfresh-kafka)                 │
│                    (qué ya pasó)   ├─ orders.events ──► reportes :8084      │
│                                    │                └─► auditoria :8085     │
│                                    └─ audit.timeline ─► auditoria :8085     │
│                                                                             │
│  catalog :8082 (solo lectura)      mq-admin :8086      kafka-admin :8087    │
└──────────┬──────────────────────────────────────────────────────┬───────────┘
           │ JDBC                                                  │ AdminClient
           ▼                                                       ▼
┌──────────────────────────┐              ┌───────────────────────────────────────────────┐
│ RDS PostgreSQL           │              │ EC2 cleanfresh-kafka (docker compose)         │
│ orders_db  catalog_db    │              │  Zookeeper x3 (zk1, zk2, zk3)                 │
│ notificaciones_db        │              │  Brokers x3 (kafka1, kafka2, kafka3)          │
│ reportes_db auditoria_db │              │  kafka-init (crea los tópicos) · Kafka-UI     │
└──────────────────────────┘              └───────────────────────────────────────────────┘
```

## Por qué Kafka además de RabbitMQ

| | RabbitMQ (comandos) | Kafka (eventos) |
|---|---|---|
| Qué viaja | "Envía este aviso", "genera esta boleta": una tarea que alguien debe ejecutar | "La orden ORD-0042 pasó a ACEPTADO": un hecho que ya ocurrió |
| Quién lo lee | Un consumidor; al confirmarlo, el mensaje desaparece de la cola | Varios grupos independientes, cada uno con su avance (offset) |
| Después de leerlo | Se borra | Se conserva (7 días en `orders.events`): se puede **releer** para reconstruir un reporte o auditar |
| Orden | Por cola | Por partición: todos los eventos de una orden van a la misma partición (clave = número de orden) |
| Para qué se usa acá | Notificaciones (aviso, ticket, boleta) con reintentos y DLQ | Analítica en tiempo casi real y auditoría |

`reportes` y `auditoria` necesitan leer **toda la historia** de las órdenes sin molestar a `orders` ni a `notificaciones`, y poder recalcular si cambia una regla; eso es lo que Kafka da y una cola de
trabajo no. Y como `orders` publica los eventos de forma asíncrona, **si Kafka cae el flujo de pedidos sigue** (se registra el fallo y la orden ya está guardada); lo mismo al revés: si RabbitMQ cae, Kafka sigue.

## Tópicos

3 particiones y 3 réplicas cada uno, `min.insync.replicas=2` (con `acks=all`, un evento confirmado está en al menos dos brokers).

| Tópico | Política y retención | Clave | Contenido | Quién lo lee |
|---|---|---|---|---|
| `orders.events` | `delete`, 7 días | Número de orden | Eventos de negocio: `OrderCreated`, `OrderAccepted`, `OrderPreparing`, `OrderDispatched`, `OrderDelivered`, `OrderCancelled` | `reportes` (grupo `reportes-kpis`) y `auditoria` (grupo `auditoria-registro`) |
| `audit.timeline` | `compact,delete`, 30 días | `orden:<número>:<eventId>` | Quién, qué, cuándo y desde dónde | `auditoria` (grupo `auditoria-registro`) |
| `orders.events.reportes.DLT` | `delete`, 14 días | la original | Mensaje original y error (lo que `reportes` no pudo procesar) | — (se revisa con el administrador) |
| `orders.events.auditoria.DLT` | `delete`, 14 días | la original | Ídem para `auditoria` | — |
| `audit.timeline.auditoria.DLT` | `delete`, 14 días | la original | Ídem para `auditoria` | — |

Los mensajes son JSON tipado (`OrderEventMessage` y `AuditEntryMessage`) con el mismo sobre que los comandos de RabbitMQ (`type`, `eventId`, `timestamp`, `traceId`, `correlationId`, `payload`) y las cabeceras `eventId`,
`traceId` y `type` visibles en Kafka-UI. Los parámetros de cada tópico viven en `crear-topicos.sh` y en el `application.yaml` del administrador, no en el código de los servicios.

## Cómo funciona cada servicio

- **`orders` (productor)**: tras confirmar la transacción de la base, publica el evento de negocio en `orders.events` y su registro de auditoría en `audit.timeline`, desde un hilo aparte con cola
  acotada. Productor con `acks=all`, idempotente, compresión `lz4` y reintentos. Quién hizo la acción llega en `X-Actor` (el `username` del token, que el navegador no puede inventar) y `X-Origen` (la IP: el último
  valor de `X-Forwarded-For`, el que agrega el API Gateway).
- **`reportes` (consumidor)**: `@KafkaListener` de `orders.events`; mantiene en PostgreSQL el resumen de cada orden y calcula KPIs, ventas por hora, lead time, estados activos y servicios más pedidos.
- **`auditoria` (consumidor)**: dos `@KafkaListener` con una fábrica de contenedores por tópico (sus mensajes son de tipo distinto); guarda la línea de tiempo y los eventos de negocio y los une por `traceId` para la
  trazabilidad de una orden. Solo lectura.
- **Los dos consumidores**: commit manual (el offset avanza después de guardar), idempotencia por `eventId`, validación del contrato, reintentos con espera creciente (500 ms, 1 s, 2 s) para los errores pasajeros y envío directo
  al DLT de lo que no se puede arreglar reintentando (JSON roto, tipo desconocido, campos faltantes), con el mensaje original y las cabeceras `kafka_dlt-*` del error. Rebalanceo cooperativo (`CooperativeStickyAssignor`).
- **`ms-cleanfresh-kafka-admin` (:8087)**: `AdminClient`; crea, lista, describe, modifica y elimina tópicos y sus configuraciones, sube particiones, lista y describe consumer groups con su lag, resetea offsets y
  da métricas con alerta de DLT. Los tópicos base están protegidos.

## Decisiones

- **`catalog` no publica**: es de solo lectura (solo GET), no tiene cambios que auditar; los dos tópicos los publica `orders`.
- **Rol de la auditoría**: del Admin, como dice su pantalla; no se creó un rol "Auditor".
- **PostgreSQL** para `reportes` y `auditoria` (bases `reportes_db` y `auditoria_db`), como los demás servicios, en vez de Oracle.
- **Zookeeper** (3 nodos) y no KRaft, como pide el caso. Imágenes Confluent 7.6.1 (Kafka 3.6); el cliente es `kafka-clients` 4.2.1 con Spring Kafka 4.1.1.
- **Los eventos que Kafka no recibe no se reenvían después**: si el clúster está caído más allá del plazo del productor (30 s), el evento se registra en el log y se pierde para Kafka (la orden y los comandos de RabbitMQ no
  se pierden). Un patrón *outbox* lo resolvería; queda como mejora.
- **Cada compose en su máquina** (apps, RabbitMQ, Kafka), como indica el caso; Kafka-UI en su propio compose.

## Más información

Specs en [`specs/`](specs/README.md), evidencia en [`EVIDENCIA-EP5.md`](EVIDENCIA-EP5.md), despliegue en [`despliegue/`](despliegue/README.md) y demostraciones en [`demostraciones/KAFKA.md`](demostraciones/KAFKA.md).
