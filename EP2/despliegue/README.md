# Despliegue con Docker (EP2)

`docker-compose.yml` levanta los 6 microservicios (orders 8081, catalog 8082, notificaciones 8083, reportes 8084, auditoría 8085, mq-admin 8086) con `restart: unless-stopped`. Es el archivo que corre en la **EC2 #2**. El BFF corre en la EC2 #1 con su propio `Dockerfile` (ver el README de `ms-cleanfresh-bff`).

## Uso

1. Clonar los repos de los 6 microservicios lado a lado con este (el compose construye las imágenes desde `../../../ms-cleanfresh-*`).
2. Copiar `.env.example` a `.env` y completar (el `.env` no se sube a git). Las variables `RABBITMQ_*` apuntan a la **IP privada** de la EC2 `cleanfresh-mq`, donde corre el clúster (ver [`mq/README.md`](mq/README.md)).
3. `docker compose up -d --build`

En la EC2, el endpoint de RDS va en `ORDERS_DB_URL`/`CATALOG_DB_URL`. Para probar en una máquina con Docker Desktop y un Postgres local, usar `host.docker.internal` como host.

Para que sobrevivan a un reinicio de la EC2, el servicio Docker debe arrancar solo (`sudo systemctl enable docker`).

## Verificar que todo sigue funcionando

`verificar.sh` comprueba, en la EC2 #2, los contenedores, que cada servicio
responda, que el administrador vea los dos nodos de RabbitMQ y la topología,
las bases en la RDS (consulta directa con el usuario de cada servicio), el
aislamiento entre bases y el recorrido por RabbitMQ (`orders` publica y
`notificaciones` consume: aviso al Operador/Cliente, ticket de taller y boleta).
Crea una orden de prueba.

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP2/despliegue
./verificar.sh              # comprobación rápida
./verificar.sh --reiniciar  # además reinicia orders y comprueba la persistencia
```

Termina con `Todo OK`, o con el número de comprobaciones que fallaron. En una
máquina local sin RabbitMQ (`RABBIT_ENABLED=false`) el paso de los comandos falla a propósito.

## Demostraciones

Las demostraciones de RabbitMQ para el profesor (servicio caído, nodo caído y cola muerta), paso a paso, están en
[`../demostraciones/RABBITMQ.md`](../demostraciones/RABBITMQ.md); la operación general, en
[`../demostraciones/OPERACION.md`](../demostraciones/OPERACION.md). Scripts de esta carpeta:

### Desacople

`demo-desacople.sh` detiene `notificaciones`, crea una orden, muestra que los comandos esperan en las colas de
RabbitMQ (sin consumidores) y que, al volver el servicio, los consume y genera el aviso y el ticket de taller.

```bash
./demo-desacople.sh
```

### Notificaciones en los dos sentidos

`demo-notificaciones.sh` narra y comprueba el recorrido Cliente → Operador y Operador → Cliente, también con `notificaciones`
caído (con `--pausas` se detiene en cada paso para mirar la consola de RabbitMQ).

```bash
./demo-notificaciones.sh --pausas
```

### Bajar y subir `notificaciones` desde tu PC

`servicio-notificaciones.ps1` (PowerShell) detiene o levanta el servicio en la EC2 por SSH, para mostrar cómo RabbitMQ
conserva los mensajes mientras está caído:

```powershell
.\servicio-notificaciones.ps1 estado -Ip <IP-EC2-ms>
.\servicio-notificaciones.ps1 bajar  -Ip <IP-EC2-ms>
.\servicio-notificaciones.ps1 subir  -Ip <IP-EC2-ms>
```
