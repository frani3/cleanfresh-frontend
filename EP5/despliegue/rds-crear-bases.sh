#!/bin/bash
# Crea reportes_db y auditoria_db en la RDS (EP5). Repetible. Se ejecuta en la EC2 de los microservicios, que es la única con acceso a la RDS.
#
#   RDS_HOST=<endpoint-rds> RDS_MASTER_USER=postgres RDS_MASTER_PASSWORD=... \
#   REPORTES_DB_PASSWORD=... AUDITORIA_DB_PASSWORD=... ./rds-crear-bases.sh
#
# Las claves de reportes_user y auditoria_user son las mismas que van en el .env de EP2/despliegue. Nada se imprime ni se guarda.
set -eu
cd "$(dirname "$0")"
: "${RDS_HOST:?definir RDS_HOST (endpoint de la RDS)}"
: "${RDS_MASTER_USER:?definir RDS_MASTER_USER}"
: "${RDS_MASTER_PASSWORD:?definir RDS_MASTER_PASSWORD}"
: "${REPORTES_DB_PASSWORD:?definir REPORTES_DB_PASSWORD}"
: "${AUDITORIA_DB_PASSWORD:?definir AUDITORIA_DB_PASSWORD}"

# En local (pruebas) PSQL_CMD puede apuntar a otro cliente; por defecto, el cliente de la imagen postgres:16.
if [ -n "${PSQL_CMD:-}" ]; then
  $PSQL_CMD -v ON_ERROR_STOP=1 -v rep_pass="$REPORTES_DB_PASSWORD" -v aud_pass="$AUDITORIA_DB_PASSWORD" -f - < rds-crear-bases.sql
else
  docker run --rm -i -e PGPASSWORD="$RDS_MASTER_PASSWORD" postgres:16 \
    psql -h "$RDS_HOST" -U "$RDS_MASTER_USER" -d postgres -v ON_ERROR_STOP=1 \
         -v rep_pass="$REPORTES_DB_PASSWORD" -v aud_pass="$AUDITORIA_DB_PASSWORD" -f - < rds-crear-bases.sql
fi
