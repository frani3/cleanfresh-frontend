# Despliegue con Docker (EP2)

`docker-compose.yml` levanta los 5 microservicios (orders 8081, catalog 8082, notificaciones 8083, reportes 8084, auditoría 8085) con `restart: unless-stopped`. Es el archivo que corre en la **EC2 #2**. El BFF corre en la EC2 #1 con su propio `Dockerfile` (ver el README de `ms-cleanfresh-bff`).

## Uso

1. Clonar los repos de los 5 microservicios lado a lado con este (el compose construye las imágenes desde `../../../ms-cleanfresh-*`).
2. Copiar `.env.example` a `.env` y completar (el `.env` no se sube a git).
3. `docker compose up -d --build`

En la EC2, el endpoint de RDS va en `ORDERS_DB_URL`/`CATALOG_DB_URL`. Para probar en una máquina con Docker Desktop y un Postgres local, usar `host.docker.internal` como host.

Para que sobrevivan a un reinicio de la EC2, el servicio Docker debe arrancar solo (`sudo systemctl enable docker`).

## Verificar que todo sigue funcionando

`verificar.sh` comprueba, en la EC2 #2, los contenedores, que cada servicio
responda, las bases en la RDS (consulta directa con el usuario de cada
servicio), el aislamiento entre bases y el recorrido por la cola SQS
(`orders` publica y `notificaciones` consume). Crea una orden de prueba.

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP2/despliegue
./verificar.sh              # comprobación rápida
./verificar.sh --reiniciar  # además reinicia orders y comprueba la persistencia
```

Termina con `Todo OK`, o con el número de comprobaciones que fallaron. En una
máquina local sin SQS (`SQS_ENABLED=false`) el paso de la cola falla a propósito.
