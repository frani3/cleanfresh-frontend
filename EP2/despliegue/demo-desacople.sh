#!/usr/bin/env bash
# Demostración del desacople con RabbitMQ (Spec 029/030/033): el cliente solicita un servicio
# mientras el microservicio de notificaciones está caído. La solicitud no se pierde:
# se guarda en orders, los comandos esperan en las colas de RabbitMQ y, cuando notificaciones
# vuelve a levantarse, los consume y genera el aviso (y el ticket de taller).
#
# Uso (en la EC2 #2):  ./demo-desacople.sh
# Detiene `notificaciones` durante la demostración y lo deja levantado al final.
# Crea una orden de prueba en Providencia (cliente "Demo-Desacople-HHMMSS").
# Lee las colas por la API de administración de RabbitMQ (RABBITMQ_MGMT_URLS del .env).
set -u
cd "${DESPLIEGUE_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

MQ_API="${RABBITMQ_MGMT_URLS%%,*}"
COLAS_CMD="q.cmd.email q.cmd.kitchen q.cmd.invoice"
PASO=0
paso()  { PASO=$((PASO+1)); printf '\n\033[1m[%s] %s\033[0m\n' "$PASO" "$1"; }
ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
info()  { printf '       %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
FALLOS=0

# Mensajes pendientes en una cola (vía la API del panel; sus cifras se refrescan cada pocos segundos)
mensajes() { curl -s -m 10 -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" "$MQ_API/queues/%2F/$1" | grep -o '"messages":[0-9]*' | head -1 | cut -d: -f2; }
consumidores() { curl -s -m 10 -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" "$MQ_API/queues/%2F/$1" | grep -o '"consumers":[0-9]*' | head -1 | cut -d: -f2; }
total_colas() { local t=0 m q; for q in $COLAS_CMD; do m=$(mensajes "$q"); [ -n "$m" ] || return 1; t=$((t+m)); done; echo "$t"; }
mostrar_colas() {
  local q linea=""
  for q in $COLAS_CMD; do linea="$linea $q=$(mensajes "$q" || echo '?') (consumidores: $(consumidores "$q" || echo '?'));"; done
  info "RabbitMQ ->$linea"
}
aviso_de() { curl -s "localhost:8083/api/notificaciones?sucursal=Providencia" | grep -o "\"mensaje\":\"Nuevo pedido $1[^\"]*" | sed 's/"mensaje":"//' | head -1; }
ticket_de() { curl -s "localhost:8083/api/tickets" | grep -c "\"numeroOrden\":\"$1\""; }

paso "Estado inicial: todo en marcha y las colas vacías"
docker compose ps --format '{{.Service}} {{.Status}}' | grep -E "^(orders|notificaciones) " | while read -r l; do info "$l"; done
mostrar_colas
base=$(total_colas || echo "")

paso "Se cae el microservicio de notificaciones"
docker compose stop notificaciones >/dev/null 2>&1
est=$(docker compose ps --format '{{.Service}} {{.Status}}' | grep "^notificaciones " || true)
[ -z "$est" ] || [[ "$est" != *"Up"* ]] && ok "notificaciones detenido (${est:-sin contenedor en ejecución})" || fallo "notificaciones sigue en ejecución: $est"
cod=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "localhost:8083/api/notificaciones")
[ "$cod" = "000" ] && ok "su puerto 8083 ya no responde" || fallo "el puerto 8083 responde HTTP $cod"
esperar_sin=0; for _ in $(seq 1 15); do
  [ "$(consumidores q.cmd.email)" = "0" ] && [ "$(consumidores q.cmd.kitchen)" = "0" ] && esperar_sin=1 && break; sleep 2; done
[ "$esperar_sin" = "1" ] && ok "las colas q.cmd.email y q.cmd.kitchen quedaron sin consumidores" || info "(las cifras del panel tardan unos segundos en actualizarse)"

paso "El cliente solicita un servicio (POST /api/orders) con notificaciones caído"
marca="Demo-Desacople-$(date +%H%M%S)"
resp=$(curl -s -w '\nHTTP %{http_code}' -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
  -d "{\"cliente\":\"$marca\",\"servicio\":\"Lavado en seco\",\"total\":45000,\"sucursal\":\"Providencia\"}")
cod=$(echo "$resp" | tail -1 | grep -o '[0-9]*$')
num=$(echo "$resp" | grep -o 'ORD-[0-9]*' | head -1)
[ "$cod" = "201" ] && [ -n "$num" ] && ok "la solicitud se aceptó: $num creada (HTTP 201), aunque notificaciones está caído" || fallo "no se creó la orden (HTTP $cod): $resp"
if curl -s localhost:8081/api/orders | grep -q "\"numeroOrden\":\"$num\""; then ok "$num está guardada en la base de orders (RDS)"; else fallo "$num no aparece en orders"; fi

paso "Los comandos esperan en las colas de RabbitMQ (nadie los consume todavía)"
espera=""
for _ in $(seq 1 20); do
  espera=$(total_colas || echo "")
  [ -n "$espera" ] && [ -n "$base" ] && [ "$espera" -gt "$base" ] && break
  sleep 2
done
mostrar_colas
if [ -n "$espera" ] && [ -n "$base" ]; then
  [ "$espera" -gt "$base" ] && ok "las colas pasaron de $base a $espera mensaje(s): los comandos de $num (aviso y ticket de taller) esperan en RabbitMQ" || fallo "las colas no subieron (antes $base, ahora $espera)"
else
  info "No se pudo medir las colas desde aquí; míralas en el panel de RabbitMQ (puerto 15672)."
fi
[ -z "$(aviso_de "$num")" ] && info "el aviso de $num todavía no existe (no hay quien lo procese)" || true

paso "Se levanta de nuevo el microservicio de notificaciones"
docker compose start notificaciones >/dev/null 2>&1
printf '       esperando a que arranque'
for _ in $(seq 1 45); do
  [ "$(curl -s -o /dev/null -m 3 -w '%{http_code}' localhost:8083/api/notificaciones)" = "200" ] && break
  printf '.'; sleep 3
done
echo
[ "$(curl -s -o /dev/null -m 3 -w '%{http_code}' localhost:8083/api/notificaciones)" = "200" ] && ok "notificaciones volvió a responder" || fallo "notificaciones no volvió a levantar"

paso "Al volver, consume los mensajes que esperaban y genera el aviso y el ticket"
a=""
for _ in $(seq 1 20); do a=$(aviso_de "$num"); [ -n "$a" ] && break; sleep 3; done
[ -n "$a" ] && ok "aviso generado para el Operador de Providencia: $a" || fallo "no apareció el aviso de $num"
for _ in $(seq 1 10); do [ "$(ticket_de "$num")" -ge 1 ] && break; sleep 2; done
[ "$(ticket_de "$num")" = "1" ] && ok "ticket de taller registrado para $num" || fallo "ticket de $num: $(ticket_de "$num") (se esperaba 1)"
# Las cifras del panel se refrescan cada pocos segundos: se espera a que se estabilicen.
fin=""
for _ in $(seq 1 25); do
  fin=$(total_colas || echo "")
  [ -n "$fin" ] && [ -n "$base" ] && [ "$fin" -le "$base" ] && break
  sleep 3
done
mostrar_colas
if [ -n "$fin" ] && [ -n "$base" ]; then
  [ "$fin" -le "$base" ] && ok "las colas volvieron a $fin mensaje(s): el pedido se consumió" || fallo "las colas siguen en $fin (antes $base)"
fi
n=$(curl -s "localhost:8083/api/notificaciones?sucursal=Providencia" | grep -o "\"numeroOrden\":\"$num\"" | wc -l)
[ "$n" = "1" ] && ok "un solo aviso para $num (sin duplicados)" || fallo "hay $n avisos de $num (se esperaba 1)"

echo
[ "$FALLOS" -eq 0 ] && echo "Desacople demostrado: la solicitud sobrevivió a la caída y llegó cuando el servicio volvió." \
  || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
