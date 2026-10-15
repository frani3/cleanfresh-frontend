#!/bin/bash
# Demostración de alta disponibilidad del clúster: se cae un nodo y el sistema sigue; se reinician los
# dos y los mensajes persistentes siguen en las colas.
#   1. Publica un mensaje persistente por rabbit1.
#   2. Detiene rabbit1 (la "caída").
#   3. Lo lee desde rabbit2 (el espejo asumió la cola) y publica otro mensaje con rabbit1 caído.
#   4. Levanta rabbit1 y comprueba que ambos mensajes siguen en la cola.
#   5. Reinicia los dos nodos y comprueba que los mensajes persistentes sobreviven.
# Uso (en la carpeta mq/, con el .env):  ./demo-nodo-caido.sh
# Usa la cola q.cmd.email: la deja vacía al terminar. No usar con tráfico real.
set -u
cd "${MQ_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

AUTH="$RABBITMQ_USER:$RABBITMQ_PASSWORD"
API1="${MQ_API1:-http://localhost:15672}/api"
API2="${MQ_API2:-http://localhost:15673}/api"
FALLOS=0
PASO=0

paso()  { PASO=$((PASO+1)); printf '\n\033[1m[%s] %s\033[0m\n' "$PASO" "$1"; }
ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
info()  { printf '       %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
api()   { curl -s -m 20 -u "$AUTH" "$@"; }

publicar() { # api marca
  api -X POST "$1/exchanges/%2F/cmd.direct/publish" -H 'content-type: application/json' \
    -d "{\"properties\":{\"delivery_mode\":2},\"routing_key\":\"email.send\",\"payload\":\"{\\\"demo\\\":\\\"$2\\\"}\",\"payload_encoding\":\"string\"}"
}
mensajes() { # api -> cuántos mensajes hay en la cola (se leen sin consumirlos)
  api -X POST "$1/queues/%2F/q.cmd.email/get" -H 'content-type: application/json' \
    -d '{"count":50,"ackmode":"ack_requeue_true","encoding":"auto"}' | grep -o '"payload"' | wc -l
}
nodos_activos() { api "$1/nodes" | grep -o '"running":true' | wc -l; }
esperar_nodos() { for _ in $(seq 1 60); do [ "$(nodos_activos "$API1")" -ge 2 ] 2>/dev/null && return 0; sleep 4; done; return 1; }

paso "Estado inicial: dos nodos activos y la cola vacía"
api -X DELETE "$API1/queues/%2F/q.cmd.email/contents" >/dev/null
[ "$(nodos_activos "$API1")" -ge 2 ] && ok "2 nodos activos" || fallo "no hay 2 nodos activos"

paso "Se publica un mensaje persistente por rabbit1"
publicar "$API1" "antes-de-la-caida" | grep -q '"routed":true' && ok "mensaje 1 publicado y enrutado a q.cmd.email" || fallo "no se pudo publicar"
sleep 3

paso "Se cae rabbit1"
docker compose stop rabbit1 >/dev/null 2>&1
sleep 8
act=$(nodos_activos "$API2")
[ "$act" = "1" ] && ok "rabbit2 ve un solo nodo activo (rabbit1 caído)" || fallo "rabbit2 ve $act nodos activos"

paso "El sistema sigue funcionando por rabbit2"
n=$(mensajes "$API2")
[ "$n" -ge 1 ] && ok "el mensaje publicado antes de la caída sigue en la cola y se lee desde rabbit2" || fallo "se perdió el mensaje: rabbit2 no lo ve ($n)"
publicar "$API2" "con-rabbit1-caido" | grep -q '"routed":true' && ok "se publica un mensaje nuevo con rabbit1 caído (mensaje 2)" || fallo "no se pudo publicar con rabbit1 caído"
sleep 3

paso "Vuelve rabbit1"
docker compose start rabbit1 >/dev/null 2>&1
esperar_nodos && ok "los dos nodos vuelven a estar activos" || fallo "rabbit1 no volvió al clúster"
sleep 8
n=$(mensajes "$API1")
[ "$n" = "2" ] && ok "los 2 mensajes siguen en la cola (visto desde rabbit1)" || fallo "se esperaban 2 mensajes y hay $n"

paso "Se reinician los dos nodos: los mensajes persistentes sobreviven"
docker compose restart rabbit1 rabbit2 >/dev/null 2>&1
esperar_nodos && ok "el clúster se volvió a formar solo" || fallo "el clúster no se reformó"
sleep 10
n=$(mensajes "$API1")
[ "$n" = "2" ] && ok "los 2 mensajes persistentes siguen en q.cmd.email tras el reinicio" || fallo "tras reiniciar hay $n mensajes (se esperaban 2)"
mir=$(api "$API1/queues/%2F/q.cmd.email" | grep -o '"synchronised_slave_nodes":\["rabbit@[a-z0-9]*"' | cut -d'"' -f4)
[ -n "$mir" ] && ok "la cola conserva su espejo sincronizado en $mir" || info "el espejo aún no figura como sincronizado (las estadísticas tardan unos segundos)"

api -X DELETE "$API1/queues/%2F/q.cmd.email/contents" >/dev/null
echo
[ "$FALLOS" -eq 0 ] && echo "Alta disponibilidad demostrada: el sistema siguió sin un nodo y no se perdió ningún mensaje." || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
