# Despliegue de Kafka en AWS (EP5, Spec 047)

Cómo sumar Kafka al entorno de AWS Academy que ya existe (BFF, microservicios, RabbitMQ y RDS; ver la sección "Despliegue en AWS" de [`../../CLAUDE.md`](../../CLAUDE.md)). Se agrega **una EC2
nueva para Kafka**, dos bases en la RDS y se actualizan las EC2 del BFF y de los microservicios. Cada compose corre en su máquina, como pide el caso: apps, RabbitMQ y Kafka.

```
BFF (EC2 #1) ──► microservicios (EC2 #2) ──► RDS (reportes_db, auditoria_db, ...)
                       │  orders ──produce──┐
                       │  reportes ◄─consume┤──► Kafka (EC2 cleanfresh-kafka: Zookeeper x3 + 3 brokers)
                       │  auditoria ◄───────┘          └─ Kafka-UI (:8090, solo desde tu IP)
                       └─ RabbitMQ (EC2 cleanfresh-mq): sin cambios
```

Las IP públicas cambian cada vez que se apaga el laboratorio; en esta guía `<IP-privada-kafka>` y `<IP-privada-ms>` son las privadas (no cambian) y `<IP-publica-...>` las públicas (se ven en la consola de EC2).

## 0. Antes de empezar

- Laboratorio encendido, con el BFF, `cleanfresh-ms`, `cleanfresh-mq` y la RDS arriba.
- La llave `key.pem` y tu IP pública (https://checkip.amazonaws.com) permitida por SSH en los grupos de seguridad (ver [`../demostraciones/KAFKA.md`](../demostraciones/KAFKA.md)).
- El repositorio `ms-cleanfresh-kafka-admin` publicado en GitHub (el compose de los microservicios lo clona y construye).

## 1. Consola de AWS

### 1.1 Grupo de seguridad de Kafka

EC2 → Security Groups → *Create*: `cleanfresh-sg-kafka` (misma VPC que los demás). Reglas de entrada:

| Puerto | Origen | Para qué |
|---|---|---|
| 9092–9094 (TCP) | `cleanfresh-sg-ms` | Los microservicios publican y consumen |
| 22 (SSH) | tu IP | Administrar la EC2 |
| 8090 (TCP) | tu IP | Kafka-UI |

Zookeeper (2181) y el tráfico entre brokers no necesitan regla: corren en la misma EC2, dentro de la red de Docker.

### 1.2 EC2 de Kafka

EC2 → *Launch instance*: nombre **`cleanfresh-kafka`**, Amazon Linux 2023, **`t3.medium`** (el clúster usa unos 1,8 GB), disco de **20 GB**, la misma key pair y el grupo `cleanfresh-sg-kafka`. Con
`LabInstanceProfile` no hace falta ningún rol. Anota su **IP privada** (`<IP-privada-kafka>`).

### 1.3 Ajustes en las EC2 existentes

- **`cleanfresh-sg-ms`**: la regla de los servicios pasa de 8081–8086 a **8081–8087** (origen `cleanfresh-sg-bff`), por el administrador de Kafka.
- **`cleanfresh-ms`**: con dos JVM más con Kafka (consumidores) y el administrador, conviene cambiar `t3.medium` → **`t3.large`** (detener, cambiar el tipo, iniciar) y ampliar el disco de 8 a **20 GB**
  (ya estaba al 86 %; ver "El disco de 8 GB se llena" en la [arquitectura de EP2](../../EP2/ARQUITECTURA.md)). Tras ampliar el volumen: `sudo growpart /dev/nvme0n1 1 && sudo xfs_growfs /`.
- **`cleanfresh-sg-rds`** no cambia: ya acepta 5432 desde `cleanfresh-sg-ms`.

## 2. EC2 de Kafka

```bash
ssh -i key.pem ec2-user@<IP-publica-kafka>

# Docker y Compose
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user          # cerrar la sesión y volver a entrar
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose && sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# El repo del frontend trae los composes
git clone https://github.com/frani3/cleanfresh-frontend && cd cleanfresh-frontend/EP5/despliegue

cd kafka
cp .env.example .env && sed -i 's/^KAFKA_ADVERTISED_HOST=.*/KAFKA_ADVERTISED_HOST=<IP-privada-kafka>/' .env
docker compose up -d                      # 1 a 2 minutos; al final kafka-init crea los tópicos
docker compose ps                         # 3 zk y 3 kafka en "healthy"

cd ../kafka-ui
cp .env.example .env && nano .env         # elegir KAFKA_UI_USER y KAFKA_UI_PASSWORD
docker compose up -d                      # http://<IP-publica-kafka>:8090 (solo desde tu IP)

cd ../kafka && ./verificar-kafka.sh       # debe terminar en "Todo OK"
```

`KAFKA_ADVERTISED_HOST` es la dirección con la que **los clientes de fuera de Docker** (los microservicios de la otra EC2) llegan a los brokers: tiene que ser la IP **privada** de esta EC2. Dentro de Docker
(Kafka-UI, `kafka-init`, entre brokers) se usan los nombres `kafka1:29092`, etc.

## 3. RDS: bases de reportes y auditoría

En la EC2 `cleanfresh-ms` (la única con acceso a la RDS), con el endpoint, la clave del usuario maestro y las claves que tendrán los usuarios nuevos (las mismas que irán en el `.env`):

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP5/despliegue
RDS_HOST=<endpoint-rds> RDS_MASTER_USER=<maestro> RDS_MASTER_PASSWORD=<clave-maestra> \
REPORTES_DB_PASSWORD=<clave-reportes> AUDITORIA_DB_PASSWORD=<clave-auditoria> ./rds-crear-bases.sh
```

Crea `reportes_db` y `auditoria_db`, un usuario por servicio, y cierra el acceso de los demás a cada base (se puede repetir sin efectos).

## 4. EC2 de los microservicios

```bash
cd ~/cleanfresh
git -C cleanfresh-frontend pull
for r in orders reportes auditoria bff catalog notificaciones mq-admin; do git -C ms-cleanfresh-$r pull 2>/dev/null; done
git clone https://github.com/frani3/ms-cleanfresh-kafka-admin        # una sola vez

cd cleanfresh-frontend/EP2/despliegue
nano .env     # agregar lo nuevo de .env.example: REPORTES_DB_*, AUDITORIA_DB_*, KAFKA_ENABLED=true y KAFKA_BOOTSTRAP_SERVERS=<IP-privada-kafka>:9092,<IP-privada-kafka>:9093,<IP-privada-kafka>:9094
df -h /; docker builder prune -f; docker image prune -f      # el disco se llena con cada reconstrucción
docker compose up -d --build
docker compose ps                                            # los 7 servicios Up
```

## 5. BFF

En la EC2 del BFF, agregar a `~/bff.env` la dirección del administrador de Kafka (sin ella el BFF busca `localhost:8087`) y reconstruir:

```bash
echo 'KAFKA_ADMIN_SERVICE_URL=http://<IP-privada-ms>:8087' >> ~/bff.env
cd ~/ms-cleanfresh-bff && git pull && docker build -q -t cleanfresh/bff .
docker rm -f bff
docker run -d --name bff --restart unless-stopped -p 8080:8080 --env-file ~/bff.env cleanfresh/bff
```

API Gateway no cambia: la ruta `ANY /{proxy+}` ya envía `/api/kafka/**`, `/api/reportes/**` y `/api/auditoria/**` al BFF.

## 6. Verificación

| Qué | Dónde | Comando |
|---|---|---|
| Clúster, tópicos, ISR y envío con `acks=all` | EC2 de Kafka | `cd EP5/despliegue/kafka && ./verificar-kafka.sh --caida` |
| Administrador y grupos de consumidores | EC2 de microservicios | `KAFKA_ADMIN_URL=http://localhost:8087 REPORTES_URL=http://localhost:8084 AUDITORIA_URL=http://localhost:8085 ./verificar-kafka.sh --solo-apps` |
| RabbitMQ sigue igual (Kafka encendido) | EC2 de microservicios | `cd EP2/despliegue && ./verificar.sh` y `./demo-notificaciones.sh` |
| RabbitMQ sigue igual (Kafka apagado) | EC2 de microservicios | con `KAFKA_ENABLED=false` en el `.env` y `docker compose up -d`, repetir lo anterior |
| Todo de punta a punta | tu PC | `npm start`, entrar como Cliente, pedir un servicio, y como Admin ver la **Analítica** y la **Auditoría**; en Kafka-UI, los mensajes de `orders.events` y `audit.timeline` |

## 7. Al terminar la evaluación

La EC2 `cleanfresh-kafka` cobra mientras exista: detenerla o eliminarla junto con las demás (ver "Costo real" en `CLAUDE.md`), y borrar el grupo `cleanfresh-sg-kafka` si se elimina.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Los servicios no conectan a Kafka (`Connection ... could not be established`) | `KAFKA_ADVERTISED_HOST` no es la IP privada de la EC2 de Kafka, o `cleanfresh-sg-kafka` no acepta 9092–9094 desde `cleanfresh-sg-ms`. Tras cambiar el `.env`: `docker compose up -d` en `kafka/` |
| Los brokers se reinician varias veces en el primer minuto | Normal tras un reinicio brusco: Zookeeper tarda en liberar los registros de la sesión anterior; con `restart: unless-stopped` se recuperan solos |
| `reportes` o `auditoria` no arrancan | Falta la base o el usuario (paso 3), o `REPORTES_DB_URL`/`AUDITORIA_DB_URL` mal escritos en el `.env` |
| `/api/kafka/...` responde 404 desde la app | Falta `KAFKA_ADMIN_SERVICE_URL` en `~/bff.env` o el grupo `cleanfresh-sg-ms` no abre el 8087 al BFF |
| `/api/kafka/...` responde 503 | El administrador no alcanza los brokers: revisar `KAFKA_BOOTSTRAP_SERVERS` y el grupo de seguridad de Kafka |
| La EC2 de microservicios se queda sin memoria | Subir a `t3.large`; `free -m` y `docker stats --no-stream` muestran quién consume |
