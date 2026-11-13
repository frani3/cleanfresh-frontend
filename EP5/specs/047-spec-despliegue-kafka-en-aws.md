---
id: 047
type: spec
status: approved
---

# Spec 047 — Despliegue de Kafka y de los servicios nuevos en AWS

## Qué debe hacer

Llevar a AWS lo que las Specs 044 a 046 dejaron funcionando en local: el clúster de Kafka, Kafka-UI, el administrador, los consumidores y las bases nuevas, con los accesos mínimos necesarios.
Como el caso pide, **cada compose corre en su máquina**: apps, RabbitMQ y Kafka.

- **EC2 nueva `cleanfresh-kafka`** (`t3.medium`, 20 GB) con `EP5/despliegue/kafka/` (Zookeeper ×3, brokers ×3 y `kafka-init`) y `EP5/despliegue/kafka-ui/`.
- **Grupo de seguridad `cleanfresh-sg-kafka`**: 9092–9094 solo desde `cleanfresh-sg-ms`; SSH y Kafka-UI (8090) solo desde la IP del autor.
- **RDS**: bases `reportes_db` y `auditoria_db`, un usuario por servicio y acceso cerrado a los demás (`rds-crear-bases.sh`).
- **EC2 `cleanfresh-ms`**: 7 servicios (se suma `kafka-admin`, :8087) con `KAFKA_ENABLED=true` y los tres brokers; pasa a `t3.large` y 20 GB; `cleanfresh-sg-ms` abre 8087 al BFF.
- **BFF**: `KAFKA_ADMIN_SERVICE_URL` en `~/bff.env`. API Gateway no cambia.
- Todo en [`../despliegue/AWS.md`](../despliegue/AWS.md), con la verificación automática `verificar-kafka.sh`.

## Fuera de alcance

- Más de un nodo de Kafka por máquina o repartir los brokers en varias EC2 (el caso pide una EC2 de Kafka).
- TLS o autenticación entre los servicios y Kafka (la red privada y los grupos de seguridad son el control de acceso, igual que con RabbitMQ).

## Acceptance Criteria

1. La EC2 `cleanfresh-kafka` corre los 3 Zookeeper y los 3 brokers `healthy`, con los 5 tópicos (3×3) y sus parámetros; `verificar-kafka.sh --caida` termina en "Todo OK".
2. Kafka-UI abre desde la IP del autor y muestra los 3 brokers y los tópicos; desde fuera de esa IP no responde. Los puertos de Kafka (9092–9094) solo aceptan a `cleanfresh-sg-ms`.
3. `reportes_db` y `auditoria_db` existen con su usuario; cada usuario entra a su base y a ninguna otra.
4. Los 7 servicios de `cleanfresh-ms` están `Up`; `orders` publica, `reportes` y `auditoria` consumen (grupos `Stable`, lag 0).
5. Con la app real (Cognito → API Gateway → BFF): un pedido del Cliente genera sus eventos; el Admin ve la **Analítica** y la **Auditoría** con ese pedido, y `/api/kafka/**` responde 200 al Admin y 403 al Operador y al Cliente.
6. RabbitMQ sigue igual: `verificar.sh`, `verificar-flujo.sh` y `demo-notificaciones.sh` en "Todo OK" con Kafka encendido y con `KAFKA_ENABLED=false`.
7. Un mensaje malo en `orders.events` llega a los DLT en AWS, y con un broker detenido el sistema sigue funcionando.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 a 7 | — | ⏳ Pendiente: el laboratorio de AWS estaba apagado. Todo lo que no depende de AWS ya se probó en local: los composes (`docker compose config` y levantados), `verificar-kafka.sh` ("Todo OK", con `--caida` y con `--solo-apps`), `rds-crear-bases.sh` contra un PostgreSQL limpio (crea, se repite sin efectos y aísla las bases) y el compose de aplicaciones validado con las variables nuevas |
