#!/bin/bash
# Verifica el flujo completo de mensajería con los servicios reales (Spec 033): orders publica comandos por
# RabbitMQ y notificaciones los consume. Comprueba los tres flujos (aviso, ticket de taller, boleta), las
# variantes del servicio exprés (cmd.topic), la idempotencia por eventId, y que un mensaje venenoso pase
# por la DLQ y quede registrado.
# Uso (en la carpeta mq/, con el .env, con orders en :8081 y notificaciones en :8083 y RabbitMQ arriba):
#   ./verificar-flujo.sh
# Crea órdenes de prueba. La revisión de las DLQ por notificaciones corre cada RABBIT_DLQ_INTERVALO_MS
# (30 s por defecto): el script espera lo necesario.
set -u
cd "${MQ_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

ORDERS="${ORDERS_URL:-http://localhost:8081}"
NOTIF="${NOTIF_URL:-http://localhost:8083}"
MQ_API="${MQ_API:-http://localhost:15672}/api"
AUTH="$RABBITMQ_USER:$RABBITMQ_PASSWORD"
ESPERA_DLQ="${ESPERA_DLQ:-60}"
TMP="$(mktemp -d)"
FALLOS=0

ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
titulo() { printf '\n\033[1m%s\033[0m\n' "$1"; }
api()   { curl -s -m 20 -u "$AUTH" "$@"; }
esperar() { # comando [segundos]
  local limite=${2:-20} i=0
  while [ $i -lt $limite ]; do eval "$1" >/dev/null 2>&1 && return 0; sleep 1; i=$((i+1)); done
  return 1
}

crear_orden() { # servicio sucursal cliente -> imprime el número de orden
  printf '{"cliente":"%s","clienteNombre":"%s","servicio":"%s","total":11900,"sucursal":"%s"}' "$3" "$3@cleanfresh.com" "$1" "$2" > "$TMP/orden.json"
  curl -s -m 20 -X POST "$ORDERS/api/orders" -H 'Content-Type: application/json' --data-binary @"$TMP/orden.json" | grep -o 'ORD-[0-9]*' | head -1
}
despachar() { curl -s -m 20 -o /dev/null -w '%{http_code}' -X PUT "$ORDERS/api/orders/$1/estado" -H 'Content-Type: application/json' -d '{"estado":"DESPACHADO"}'; }
clave_de() { # ruta numeroOrden campo -> valor del campo del registro de esa orden
  curl -s -m 20 "$NOTIF/api/$1" | grep -o "\"numeroOrden\":\"$2\"[^}]*" | grep -o "\"$3\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}
vacias() { local n=0; for q in q.cmd.email q.cmd.kitchen q.cmd.invoice q.cmd.email.dlq q.cmd.kitchen.dlq q.cmd.invoice.dlq; do
  api "$MQ_API/queues/%2F/$q" | grep -o '"messages":[0-9]*' | head -1 | cut -d: -f2 | { read -r v; n=$((n + ${v:-0})); echo $n; }; done | tail -1; }
publicar_crudo() { # exchange clave cuerpo-json-ya-escapado
  api -X POST "$MQ_API/exchanges/%2F/$1/publish" -H 'content-type: application/json' \
    -d "{\"properties\":{\"delivery_mode\":2},\"routing_key\":\"$2\",\"payload\":\"$3\",\"payload_encoding\":\"string\"}"
}
escapar() { sed 's/\\/\\\\/g; s/"/\\"/g'; }

titulo "1) Orden normal (Planchado, Providencia): cmd.direct"
N1=$(crear_orden "Planchado" "Providencia" "cli-flujo-1")
[ -n "$N1" ] && ok "orden creada: $N1" || fallo "no se creó la orden"
esperar "[ -n \"\$(clave_de tickets $N1 claveOrigen)\" ]" 20 && ok "ticket de taller registrado (clave $(clave_de tickets "$N1" claveOrigen))" || fallo "no apareció el ticket de $N1"
[ "$(clave_de tickets "$N1" claveOrigen)" = "kitchen.ticket" ] && ok "llegó por kitchen.ticket (cmd.direct)" || fallo "clave del ticket: $(clave_de tickets "$N1" claveOrigen)"
esperar "curl -s '$NOTIF/api/notificaciones?sucursal=Providencia' | grep -q '$N1'" 20 && ok "aviso al Operador de Providencia" || fallo "no apareció el aviso al Operador"
[ -z "$(clave_de boletas "$N1" claveOrigen)" ] && ok "todavía no hay boleta (la orden no está despachada)" || fallo "hay boleta antes de despachar"

titulo "2) Se despacha: aviso al Cliente y boleta"
[ "$(despachar "$N1")" = "200" ] && ok "$N1 pasada a DESPACHADO" || fallo "no se pudo despachar $N1"
esperar "curl -s '$NOTIF/api/notificaciones?cliente=cli-flujo-1' | grep -q '$N1'" 20 && ok "aviso al Cliente (por su identificador)" || fallo "no apareció el aviso al Cliente"
esperar "[ -n \"\$(clave_de boletas $N1 claveOrigen)\" ]" 20 && ok "boleta BOL-${N1#ORD-} registrada (clave $(clave_de boletas "$N1" claveOrigen))" || fallo "no apareció la boleta"
[ "$(clave_de boletas "$N1" claveOrigen)" = "invoice.gen" ] && ok "llegó por invoice.gen (cmd.direct)" || fallo "clave de la boleta: $(clave_de boletas "$N1" claveOrigen)"

titulo "3) Orden exprés: variantes por cmd.topic"
N2=$(crear_orden "Servicio expres" "Maipu" "cli-flujo-2")
[ -n "$N2" ] && ok "orden exprés creada: $N2" || fallo "no se creó la orden exprés"
esperar "[ -n \"\$(clave_de tickets $N2 claveOrigen)\" ]" 20
[ "$(clave_de tickets "$N2" claveOrigen)" = "kitchen.ticket.thermal" ] && ok "ticket llegó por kitchen.ticket.thermal (cmd.topic)" || fallo "clave del ticket exprés: $(clave_de tickets "$N2" claveOrigen)"
esperar "curl -s '$NOTIF/api/notificaciones?sucursal=Maipu' | grep -q '$N2'" 20 && ok "aviso al Operador de Maipu (email.send.high por cmd.topic)" || fallo "no apareció el aviso exprés"
despachar "$N2" >/dev/null
esperar "[ -n \"\$(clave_de boletas $N2 claveOrigen)\" ]" 20
[ "$(clave_de boletas "$N2" claveOrigen)" = "invoice.gen.pdf" ] && ok "boleta llegó por invoice.gen.pdf (cmd.topic)" || fallo "clave de la boleta exprés: $(clave_de boletas "$N2" claveOrigen)"

titulo "4) Idempotencia: el mismo mensaje dos veces produce un solo efecto"
EV="evt-idem-$(date +%s)"; IDEM="ORD-9$(date +%s)"
printf '{"type":"ORDEN_CREADA","eventId":"%s","timestamp":"2026-10-15T00:00:00Z","traceId":"t","correlationId":"%s","payload":{"numeroOrden":"%s","cliente":"cli-idem","clienteNombre":null,"servicio":"Planchado","sucursal":"Providencia","total":9500.0,"fecha":"2026-10-15"}}' "$EV" "$IDEM" "$IDEM" > "$TMP/idem.json"
CUERPO=$(escapar < "$TMP/idem.json")
publicar_crudo cmd.direct kitchen.ticket "$CUERPO" | grep -q '"routed":true' && ok "mensaje 1 publicado (eventId $EV)" || fallo "no se pudo publicar"
publicar_crudo cmd.direct kitchen.ticket "$CUERPO" >/dev/null && ok "mensaje 2 publicado: mismo eventId"
sleep 6
n=$(curl -s "$NOTIF/api/tickets" | grep -o "\"numeroOrden\":\"$IDEM\"" | wc -l)
[ "$n" = "1" ] && ok "un solo ticket para $IDEM aunque llegó dos veces" || fallo "hay $n tickets de $IDEM (se esperaba 1)"

titulo "5) Mensaje venenoso: 3 intentos, DLQ y registro"
printf 'esto no es json' | escapar > "$TMP/veneno.txt"
publicar_crudo cmd.direct email.send "$(cat "$TMP/veneno.txt")" | grep -q '"routed":true' && ok "se publica un mensaje inválido en q.cmd.email" || fallo "no se pudo publicar el venenoso"
esperar "[ \"\$(api $MQ_API/queues/%2F/q.cmd.email.dlq | grep -o '\"messages\":[0-9]*' | head -1 | cut -d: -f2)\" -ge 1 ] || curl -s '$NOTIF/api/muertos' | grep -q 'esto no es json'" 40 \
  && ok "tras 3 intentos fallidos el mensaje pasó por q.cmd.email.dlq (visible en el panel o ya registrado)" || fallo "no llegó a q.cmd.email.dlq"
[ "$(api "$MQ_API/queues/%2F/q.cmd.email" | grep -o '"messages":[0-9]*' | head -1 | cut -d: -f2)" = "0" ] && ok "q.cmd.email quedó vacía: el venenoso no bloqueó la cola" || fallo "q.cmd.email no quedó vacía"
echo "       (se espera hasta ${ESPERA_DLQ} s a que notificaciones revise la DLQ)"
esperar "curl -s '$NOTIF/api/muertos' | grep -q 'esto no es json'" "$ESPERA_DLQ" && ok "notificaciones lo registró: $(curl -s "$NOTIF/api/muertos" | grep -o '"colaOrigen":"[^"]*","motivo":"[^"]*","intentos":[0-9]*' | head -1)" || fallo "no apareció en /api/muertos"
esperar "[ \"\$(api $MQ_API/queues/%2F/q.cmd.email.dlq | grep -o '\"messages\":[0-9]*' | head -1 | cut -d: -f2)\" = 0 ]" 15 && ok "la DLQ quedó vacía tras registrarlo (se confirmó el mensaje)" || fallo "la DLQ no se vació"

titulo "6) El flujo del ticket y el de la boleta también tienen su DLQ"
printf '{"type":"ORDEN_LISTA","eventId":"evt-tipo-malo-%s","timestamp":"t","traceId":"t","correlationId":"ORD-9002","payload":{"numeroOrden":"ORD-9002","cliente":"c","servicio":"s","sucursal":"x","total":1.0,"fecha":"f"}}' "$(date +%s)" | escapar > "$TMP/tipo-malo.txt"
publicar_crudo cmd.direct kitchen.ticket "$(cat "$TMP/tipo-malo.txt")" >/dev/null
esperar "[ \"\$(api $MQ_API/queues/%2F/q.cmd.kitchen.dlq | grep -o '\"messages\":[0-9]*' | head -1 | cut -d: -f2)\" -ge 1 ]" 20 && ok "un ORDEN_LISTA en la cola de tickets va a q.cmd.kitchen.dlq (el flujo kitchen solo procesa ORDEN_CREADA)" || fallo "no llegó a q.cmd.kitchen.dlq"
esperar "curl -s '$NOTIF/api/muertos' | grep -q 'ORD-9002'" "$ESPERA_DLQ" && ok "y también queda registrado: $(curl -s "$NOTIF/api/muertos" | grep -o '"dlq":"q.cmd.kitchen.dlq","colaOrigen":"[^"]*"' | head -1)" || fallo "no se registró el mensaje de kitchen"

titulo "7) Las colas quedan vacías"
sleep 3
[ "$(vacias)" = "0" ] && ok "las 6 colas están vacías" || fallo "quedan $(vacias) mensajes en las colas"

rm -rf "$TMP"
echo
[ "$FALLOS" -eq 0 ] && echo "Todo OK" || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
