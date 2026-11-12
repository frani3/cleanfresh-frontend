---
id: 044
type: spec
status: approved
---

# Spec 044 — Kafka para eventos y analítica (complementa a RabbitMQ)

## Qué debe hacer

El sistema ya usa **RabbitMQ para comandos** (avisos, ticket de taller, boleta: tareas que alguien debe ejecutar). Se agrega **Apache
Kafka para eventos**: hechos que ya ocurrieron y que varios servicios leen a su ritmo, para analítica y auditoría en tiempo real. Es el
reparto que pide el caso Pedidos360 (Evaluación Parcial N°5 y Evaluación Final Transversal): *RabbitMQ para commands, Kafka para events*.
RabbitMQ **no cambia** (colas, exchanges, políticas, DLQ y demos siguen igual).

### Por qué Kafka y no solo RabbitMQ (justificación del diseño)

| | RabbitMQ (comandos) | Kafka (eventos) |
|---|---|---|
| Qué viaja | "Envía este aviso", "genera esta boleta" | "La orden ORD-0042 pasó a ACEPTADO" |
| Quién lo lee | Un consumidor; el mensaje se borra al confirmarlo | Varios grupos independientes, cada uno con su avance (offset) |
| Qué pasa después de leerlo | Desaparece de la cola | Se conserva (retención): se puede **releer** para reconstruir reportes o auditorías |
| Orden | Por cola | Por partición (todos los eventos de una orden van a la misma partición por su clave) |

`reportes` y `auditoria` necesitan justamente eso: leer la historia completa de las órdenes sin molestar a `orders` ni a `notificaciones`, y poder
recalcular si cambia la lógica. Si Kafka cae, **el flujo del negocio sigue** (publicar un evento nunca hace fallar un pedido) y los eventos
pendientes no bloquean a RabbitMQ.

## Arquitectura

```
orders ──► orders.events ──┬──► reportes   (grupo reportes-kpis)     → KPIs, ventas por hora, lead time, top servicios
   │                       └──► auditoria  (grupo auditoria-registro)
   └────► audit.timeline ◄── catalog          auditoria (grupo auditoria-registro) → línea de tiempo (quién/qué/cuándo/desde dónde)
                │
 fallos ──► <tópico>.<consumidor>.DLT          kafka-admin ──► AdminClient: tópicos, configuraciones y consumer groups
```

### Tópicos (3 particiones y 3 réplicas cada uno; `min.insync.replicas=2`)

| Tópico | Política | Retención | Clave | Contenido |
|---|---|---|---|---|
| `orders.events` | `delete` | 7 días | número de orden | Eventos de negocio: `OrderCreated`, `OrderAccepted`, `OrderPreparing`, `OrderDispatched`, `OrderDelivered`, `OrderCancelled` |
| `audit.timeline` | `compact,delete` | 30 días | `<entidad>:<id>:<eventId>` | Registro de auditoría: quién, qué, cuándo, desde dónde |
| `orders.events.reportes.DLT` | `delete` | 14 días | (la original) | Mensaje original y datos del error (reportes) |
| `orders.events.auditoria.DLT` | `delete` | 14 días | (la original) | Ídem (auditoría) |
| `audit.timeline.auditoria.DLT` | `delete` | 14 días | (la original) | Ídem |

Los eventos usan el mismo sobre que RabbitMQ (`type`, `eventId`, `timestamp`, `traceId`, `correlationId`, `payload`), con DTO tipados.

### Infraestructura

- `EP5/despliegue/kafka/docker-compose.yml`: **Zookeeper de 3 nodos y 3 brokers** (`kafka1..3`), con un contenedor de inicialización que crea los
  tópicos de forma repetible. Corre en su propia EC2 (`cleanfresh-kafka`) y también en local.
- `EP5/despliegue/kafka-ui/docker-compose.yml`: **Kafka-UI** para administrar brokers y tópicos, en su propio archivo.
- `ms-cleanfresh-kafka-admin` (:8087): microservicio administrador (AdminClient): crear, listar, describir, modificar configuraciones, aumentar
  particiones y eliminar tópicos; listar y describir consumer groups (miembros y *lag*). Se llega solo por el BFF (`/api/kafka/**`, rol Admin).
- Un compose por máquina (apps, RabbitMQ, Kafka), como indica el caso.

## Fuera de alcance

- Cambiar RabbitMQ o los comandos existentes.
- Esquema de registro (Schema Registry) y Kafka Connect.
- Reglas de negocio nuevas del caso (despacho sin aceptar, stock): se mantienen como están, por decisión del autor.
- Migrar el frontend a Angular o el login a Azure AD: se mantiene React con Cognito (caso adaptado, aceptado desde EP1).

## Acceptance Criteria

Cada AC indica el indicador de la rúbrica que cubre (EP5 = Evaluación Parcial N°5; EFT = Evaluación Final Transversal).

| # | AC | Rúbrica |
|---|---|---|
| 1 | `kafka/docker-compose.yml` levanta 3 nodos Zookeeper (un líder y dos seguidores) y 3 brokers que forman un clúster; `docker compose config` sin errores | EFT "Zookeeper 3 nodos y 3 brokers" |
| 2 | `kafka-ui/docker-compose.yml` levanta Kafka-UI y muestra los 3 brokers y los tópicos; desde la interfaz se puede crear un tópico y ver sus particiones y réplicas | EFT "Kafka-ui" |
| 3 | Existen `orders.events` y `audit.timeline`, cada uno con 3 particiones, 3 réplicas, la política y la retención de la tabla; los DLT también | EP5 parámetros de tópicos; EFT "dos tópicos 3×3" |
| 4 | `orders`, `catalog`, `reportes` y `auditoria` tienen configuración completa del cliente Kafka (bootstrap, serializers, grupo, `acks=all`, idempotencia, commit manual, reintentos, `auto.offset.reset`), en un solo lugar por servicio | EP5 configuración del cliente |
| 5 | `orders` publica los 6 eventos a `orders.events` y entradas de auditoría a `audit.timeline`; `catalog` publica a `audit.timeline`. Con DTO tipados, serializer JSON, clave por entidad y sin bloquear ni hacer fallar la operación si Kafka no responde | EP5 productores; EFT integración |
| 6 | `reportes` consume `orders.events` y `auditoria` consume ambos tópicos, con `@KafkaListener`, confirmación manual y la lógica de dominio en un servicio aparte | EP5 consumidores y "ambos tópicos" |
| 7 | Un mensaje inválido (JSON roto o campos obligatorios ausentes) no detiene el consumo: se registra con contexto, se reintenta lo reintentable con espera creciente y va a su DLT con el mensaje original y el error (excepción, partición, offset, consumidor). Los eventos repetidos no duplican resultados (idempotencia por `eventId`) | EP5 manejo de errores |
| 8 | `reportes` y `auditoria` usan grupos distintos sobre `orders.events` (cada uno recibe todos los eventos) y, dentro de un grupo, dos instancias se reparten las particiones; se ve en Kafka-UI y en el administrador | EP5 consumer groups |
| 9 | `kafka-admin` permite crear, listar, describir, modificar (configuraciones y particiones) y eliminar tópicos, y listar y describir consumer groups con su *lag*; restaurar la topología base es idempotente; solo Admin por el BFF (Cliente y Operador reciben 403, sin token 401) | EP5 administrador (2 indicadores); EFT administrador |
| 10 | RabbitMQ sigue igual: `verificar.sh`, `verificar-flujo.sh` y `demo-notificaciones.sh` en "Todo OK" con Kafka encendido y con Kafka apagado | EP5 "sin afectar RabbitMQ" |
| 11 | Todo desplegado en AWS: EC2 `cleanfresh-kafka` con su compose, grupos de seguridad con solo los puertos necesarios y los servicios de `cleanfresh-ms` conectados | EFT despliegue |
| 12 | Documentación en `EP5/`: arquitectura con la justificación, despliegue, guion de demostración y evidencia | Defensa |

## Plan por fases (cada fase con su verificación y su commit)

1. Specs y estructura `EP5/` (esta spec). 2. Composes de Kafka y Kafka-UI, probados en local. 3. `kafka-admin` y su ruta en el BFF.
4. Productores en `orders` y `catalog`. 5. Consumidores, errores, DLT y grupos en `reportes` y `auditoria` (Spec 045: sus endpoints y pantallas).
6. Swagger en los servicios que no lo tienen (Spec 046). 7. Despliegue en AWS y documentación (Spec 047).

## Verificación

Salidas en [`../EVIDENCIA-EP5.md`](../EVIDENCIA-EP5.md). Se completa al cerrar cada fase.

| # | AC | Estado |
|---|---|---|
| 1 | 3 Zookeeper y 3 brokers | ✅ Cumple en local (fase 2): Zookeeper con 1 líder y 2 seguidores, 3 brokers `healthy`. Falta repetirlo en AWS (AC 11) |
| 2 | Kafka-UI | ✅ Cumple en local: clúster `online` con 3 brokers y 5 tópicos; se crea y borra un tópico desde la interfaz |
| 3 | Tópicos 3×3 con sus parámetros | ✅ Cumple en local: `--describe` de los 5 tópicos; `kafka-init` es repetible |
| 4 a 10 | — | ⏳ Pendiente (fases 3 a 6) |
| 11 | Despliegue en AWS | ⏳ Pendiente (fase 7) |
| 12 | Documentación | 🟡 En curso (`EP5/README.md`, `despliegue/README.md` y `EVIDENCIA-EP5.md` creados; faltan arquitectura y guion de demostración) |
