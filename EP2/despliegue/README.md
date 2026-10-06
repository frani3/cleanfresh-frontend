# Despliegue con Docker (EP2)

`docker-compose.yml` levanta los 5 microservicios (orders 8081, catalog 8082, notificaciones 8083, reportes 8084, auditoría 8085) con `restart: unless-stopped`. Es el archivo que corre en la **EC2 #2**. El BFF corre en la EC2 #1 con su propio `Dockerfile` (ver el README de `ms-cleanfresh-bff`).

## Uso

1. Clonar los repos de los 5 microservicios lado a lado con este (el compose construye las imágenes desde `../../../ms-cleanfresh-*`).
2. Copiar `.env.example` a `.env` y completar (el `.env` no se sube a git).
3. `docker compose up -d --build`

En la EC2, el endpoint de RDS va en `ORDERS_DB_URL`/`CATALOG_DB_URL`. Para probar en una máquina con Docker Desktop y un Postgres local, usar `host.docker.internal` como host.

Para que sobrevivan a un reinicio de la EC2, el servicio Docker debe arrancar solo (`sudo systemctl enable docker`).
