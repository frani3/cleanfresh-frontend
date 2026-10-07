#!/usr/bin/env bash
# Verifica en la EC2 #2 que lo implementado en EP2 sigue funcionando:
# contenedores, bases en la RDS, aislamiento entre bases, cola SQS y avisos
# dirigidos (al Operador cuando entra un pedido, al Cliente cuando queda listo).
# Uso:  ./verificar.sh              (crea 1 orden de prueba y la despacha)
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
# Repite una comprobación hasta 10 veces (cada 2 s): la cola y el consumidor tardan unos segundos.
esperar() { for _ in 1 2 3 4 5 6 7 8 9 10; do if eval "$1"; then return 0; fi; sleep 2; done; return 1; }
sin_acceso() { [[ "$1" == *"permission denied"* || "$1" == *"CONNECT"* ]]; }
HO=$(host_de "$ORDERS_DB_URL"); HC=$(host_de "$CATALOG_DB_URL"); HN=$(host_de "${NOTIFICACIONES_DB_URL:-jdbc:postgresql://sin-configurar/x}")

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
cod=$(curl -s -o /dev/null -w '%{http_code}' "localhost:8083/api/notificaciones")
[ "$cod" = "200" ] && ok "notificaciones: API de avisos responde (HTTP 200)" || fallo "notificaciones no responde (HTTP $cod)"

echo "3) Bases de datos en la RDS (consulta directa con el usuario de cada servicio)"
r=$(psql_en "$ORDERS_DB_USER" "$ORDERS_DB_PASSWORD" "$HO" orders_db "select count(*)||' órdenes, última '||max(numero_orden) from ordenes")
[[ "$r" == *"órdenes"* ]] && ok "orders_db: $r" || fallo "orders_db: $r"
r=$(psql_en "$CATALOG_DB_USER" "$CATALOG_DB_PASSWORD" "$HC" catalog_db "select (select count(*) from servicios)||' servicios, '||(select count(*) from servicio_sucursal)||' filas de disponibilidad por sucursal'")
[[ "$r" == *"servicios"* ]] && ok "catalog_db: $r" || fallo "catalog_db: $r"
r=$(psql_en "${NOTIFICACIONES_DB_USER:-x}" "${NOTIFICACIONES_DB_PASSWORD:-x}" "$HN" notificaciones_db "select count(*)||' avisos ('||count(*) filter (where not leida)||' sin leer)' from notificaciones")
[[ "$r" == *"avisos"* ]] && ok "notificaciones_db: $r" || fallo "notificaciones_db: $r"

echo "4) Aislamiento: cada usuario solo entra a su base"
r=$(psql_en "$ORDERS_DB_USER" "$ORDERS_DB_PASSWORD" "$HC" catalog_db "select 1")
sin_acceso "$r" && ok "orders_user NO puede entrar a catalog_db" || fallo "orders_user entró a catalog_db: $r"
r=$(psql_en "$CATALOG_DB_USER" "$CATALOG_DB_PASSWORD" "$HO" orders_db "select 1")
sin_acceso "$r" && ok "catalog_user NO puede entrar a orders_db" || fallo "catalog_user entró a orders_db: $r"
r=$(psql_en "$ORDERS_DB_USER" "$ORDERS_DB_PASSWORD" "$HN" notificaciones_db "select 1")
sin_acceso "$r" && ok "orders_user NO puede entrar a notificaciones_db" || fallo "orders_user entró a notificaciones_db: $r"
r=$(psql_en "${NOTIFICACIONES_DB_USER:-x}" "${NOTIFICACIONES_DB_PASSWORD:-x}" "$HO" orders_db "select 1")
sin_acceso "$r" && ok "notificaciones_user NO puede entrar a orders_db" || fallo "notificaciones_user entró a orders_db: $r"

echo "5) Avisos por SQS: pedido nuevo -> Operador; pedido listo -> Cliente"
marca="Verificacion-$(date +%H%M%S)"
resp=$(curl -s -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
  -d "{\"cliente\":\"$marca\",\"servicio\":\"Planchado\",\"total\":9500,\"sucursal\":\"Providencia\"}")
num=$(echo "$resp" | grep -o 'ORD-[0-9]*' | head -1)
[ -n "$num" ] && ok "orden creada: $num (cliente $marca, sucursal Providencia)" || fallo "no se creó la orden: $resp"
if [ -z "$num" ]; then
  fallo "sin número de orden: se omiten las comprobaciones de la cola"
else
  if esperar "curl -s 'localhost:8083/api/notificaciones?sucursal=Providencia' | grep -q '\"ORDEN_CREADA\".*\"numeroOrden\":\"$num\"\\|\"numeroOrden\":\"$num\".*\"ORDEN_CREADA\"'"; then
    ok "aviso al Operador de Providencia: $(curl -s 'localhost:8083/api/notificaciones?sucursal=Providencia' | grep -o "\"mensaje\":\"Nuevo pedido $num[^\"]*" | sed 's/"mensaje":"//' | head -1)"
  else
    fallo "no apareció el aviso de pedido nuevo para $num (revisar SQS_ENABLED, SQS_QUEUE_URL y el perfil IAM)"
  fi
  sin=$(curl -s "localhost:8083/api/notificaciones?cliente=$marca" | grep -o '"numeroOrden"' | wc -l)
  [ "$sin" = "0" ] && ok "el Cliente aún no tiene avisos (la orden no está lista)" || fallo "el Cliente ya tenía $sin aviso(s) antes de despachar"

  cod=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "localhost:8081/api/orders/$num/estado" -H 'Content-Type: application/json' -d '{"estado":"DESPACHADO"}')
  [ "$cod" = "200" ] && ok "orden $num pasada a DESPACHADO (HTTP 200)" || fallo "no se pudo despachar $num (HTTP $cod)"
  curl -s -o /dev/null -X PUT "localhost:8081/api/orders/$num/estado" -H 'Content-Type: application/json' -d '{"estado":"DESPACHADO"}'
  cod=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "localhost:8081/api/orders/$num/estado" -H 'Content-Type: application/json' -d '{"estado":"VOLANDO"}')
  [ "$cod" = "400" ] && ok "un estado inválido se rechaza (HTTP 400)" || fallo "un estado inválido respondió HTTP $cod (se esperaba 400)"

  if esperar "curl -s 'localhost:8083/api/notificaciones?cliente=$marca' | grep -q '\"numeroOrden\":\"$num\"'"; then
    ok "aviso al Cliente: $(curl -s "localhost:8083/api/notificaciones?cliente=$marca" | grep -o "\"mensaje\":\"Tu pedido $num[^\"]*" | sed 's/"mensaje":"//' | head -1)"
  else
    fallo "no apareció el aviso de pedido listo para $marca"
  fi
  sleep 4
  dup=$(curl -s "localhost:8083/api/notificaciones?cliente=$marca" | grep -o '"numeroOrden"' | wc -l)
  [ "$dup" = "1" ] && ok "despachar dos veces no duplica el aviso ($dup aviso)" || fallo "el Cliente tiene $dup avisos de $num (se esperaba 1)"
  m=$(curl -s -X PUT "localhost:8083/api/notificaciones/leidas?cliente=$marca" | grep -o '[0-9]*' | head -1)
  [ "$m" = "1" ] && ok "marcar leídos solo afecta a ese Cliente ($m aviso)" || fallo "marcar leídos devolvió: $m"
  docker compose logs --since 3m orders 2>&1 | grep -q "No se pudo publicar" && fallo "orders no pudo publicar en SQS" || ok "orders sin errores de publicación"
fi

if [ "${1:-}" = "--reiniciar" ]; then
  echo "6) Persistencia tras reiniciar orders y notificaciones"
  antes=$(curl -s localhost:8081/api/orders | grep -o '"numeroOrden"' | wc -l)
  avisos_antes=$(curl -s localhost:8083/api/notificaciones | grep -o '"numeroOrden"' | wc -l)
  docker compose restart orders notificaciones >/dev/null 2>&1; sleep 45
  despues=$(curl -s localhost:8081/api/orders | grep -o '"numeroOrden"' | wc -l)
  avisos_despues=$(curl -s localhost:8083/api/notificaciones | grep -o '"numeroOrden"' | wc -l)
  [ "$antes" = "$despues" ] && [ "$despues" -gt 0 ] && ok "órdenes antes: $antes, después: $despues" || fallo "órdenes antes: $antes, después: $despues"
  [ "$avisos_antes" = "$avisos_despues" ] && [ "$avisos_despues" -gt 0 ] && ok "avisos antes: $avisos_antes, después: $avisos_despues" || fallo "avisos antes: $avisos_antes, después: $avisos_despues"
fi

echo
[ "$FALLOS" -eq 0 ] && echo "Todo OK" || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
