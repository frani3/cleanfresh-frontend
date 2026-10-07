#!/usr/bin/env bash
# Verifica en la EC2 #2 que lo implementado en EP2 sigue funcionando:
# contenedores, bases en la RDS, aislamiento entre bases y cola SQS.
# Uso:  ./verificar.sh              (crea 1 orden de prueba, no reinicia nada)
#       ./verificar.sh --reiniciar  (además reinicia orders y comprueba persistencia)
# Requiere el .env de esta carpeta (credenciales de las bases) y Docker.
set -u
cd "$(dirname "$0")"
set -a; . ./.env; set +a

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fallo(){ printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
FALLOS=0
host_de() { echo "$1" | sed -E 's#jdbc:postgresql://([^:/]+).*#\1#'; }
psql_en() { # usuario clave host base consulta
  docker run --rm -e PGPASSWORD="$2" postgres:16 psql -h "$3" -U "$1" -d "$4" -tA -c "$5" 2>&1
}
HO=$(host_de "$ORDERS_DB_URL"); HC=$(host_de "$CATALOG_DB_URL")

echo "1) Contenedores"
for s in orders catalog notificaciones reportes auditoria; do
  est=$(docker compose ps --format '{{.Service}} {{.Status}}' | grep "^$s " )
  [[ "$est" == *"Up"* ]] && ok "$est" || fallo "$s no está Up"
done

echo "2) Servicios responden"
n=$(curl -s localhost:8081/api/orders  | grep -o '"numeroOrden"' | wc -l); [ "$n" -gt 0 ] && ok "orders: $n órdenes" || fallo "orders sin datos"
n=$(curl -s localhost:8082/api/catalog | grep -o '"nombre"' | wc -l);      [ "$n" -gt 0 ] && ok "catalog: $n servicios" || fallo "catalog sin datos"
curl -s localhost:8084/api/reportes  | grep -q '"branch"' && ok "reportes: respuesta fija" || fallo "reportes"
curl -s localhost:8085/api/auditoria | grep -q '"actor"'  && ok "auditoria: respuesta fija" || fallo "auditoria"
cod=$(curl -s -o /dev/null -w '%{http_code}' localhost:8083/)
[ "$cod" != "000" ] && ok "notificaciones: proceso activo (HTTP $cod; no tiene endpoints propios)" || fallo "notificaciones no responde"

echo "3) Bases de datos en la RDS (consulta directa con el usuario de cada servicio)"
r=$(psql_en "$ORDERS_DB_USER" "$ORDERS_DB_PASSWORD" "$HO" orders_db "select count(*)||' órdenes, última '||max(numero_orden) from ordenes")
[[ "$r" == *"órdenes"* ]] && ok "orders_db: $r" || fallo "orders_db: $r"
r=$(psql_en "$CATALOG_DB_USER" "$CATALOG_DB_PASSWORD" "$HC" catalog_db "select (select count(*) from servicios)||' servicios, '||(select count(*) from servicio_sucursal)||' filas de disponibilidad por sucursal'")
[[ "$r" == *"servicios"* ]] && ok "catalog_db: $r" || fallo "catalog_db: $r"

echo "4) Aislamiento: cada usuario solo entra a su base"
r=$(psql_en "$ORDERS_DB_USER" "$ORDERS_DB_PASSWORD" "$HC" catalog_db "select 1")
[[ "$r" == *"permission denied"* || "$r" == *"CONNECT"* ]] && ok "orders_user NO puede entrar a catalog_db" || fallo "orders_user entró a catalog_db: $r"
r=$(psql_en "$CATALOG_DB_USER" "$CATALOG_DB_PASSWORD" "$HO" orders_db "select 1")
[[ "$r" == *"permission denied"* || "$r" == *"CONNECT"* ]] && ok "catalog_user NO puede entrar a orders_db" || fallo "catalog_user entró a orders_db: $r"

echo "5) Cola SQS: orders publica y notificaciones consume"
marca="Verificacion-$(date +%H%M%S)"
resp=$(curl -s -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
  -d "{\"cliente\":\"$marca\",\"servicio\":\"Planchado\",\"total\":9500,\"sucursal\":\"Providencia\"}")
num=$(echo "$resp" | grep -o 'ORD-[0-9]*' | head -1)
[ -n "$num" ] && ok "orden creada: $num ($marca)" || fallo "no se creó la orden: $resp"
if [ -z "$num" ]; then
  fallo "sin número de orden: se omite la comprobación de la cola"
else
sleep 10
docker compose logs --since 2m notificaciones 2>&1 | grep -q "$num" \
  && ok "notificaciones recibió $num desde SQS: $(docker compose logs --since 2m notificaciones 2>&1 | grep "$num" | sed 's/.*: Notificación/Notificación/' | tail -1)" \
  || fallo "notificaciones no registró $num (revisar SQS_ENABLED, SQS_QUEUE_URL y el perfil IAM)"
docker compose logs --since 2m orders 2>&1 | grep -q "No se pudo publicar" && fallo "orders no pudo publicar en SQS" || ok "orders sin errores de publicación"
fi

if [ "${1:-}" = "--reiniciar" ]; then
  echo "6) Persistencia tras reiniciar orders"
  antes=$(curl -s localhost:8081/api/orders | grep -o '"numeroOrden"' | wc -l)
  docker compose restart orders >/dev/null 2>&1; sleep 40
  despues=$(curl -s localhost:8081/api/orders | grep -o '"numeroOrden"' | wc -l)
  [ "$antes" = "$despues" ] && [ "$despues" -gt 0 ] && ok "antes: $antes, después: $despues órdenes" || fallo "antes: $antes, después: $despues"
fi

echo
[ "$FALLOS" -eq 0 ] && echo "Todo OK" || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
