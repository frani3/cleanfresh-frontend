#!/bin/bash
# Verifica el clúster RabbitMQ y la topología del enunciado usando la API de administración:
# nodos, exchanges/colas/bindings, enrutamiento de cmd.direct y cmd.topic, y la redirección de un
# mensaje rechazado a su DLQ por cmd.dead.dlx.
# Uso (en la carpeta mq/, con el .env): ./verificar-mq.sh        MQ_API=http://host:15672 para otro host
# Usa mensajes de prueba y vacía las colas al empezar y al terminar (no usar con tráfico real).
set -u
cd "${MQ_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

MQ_API="${MQ_API:-http://localhost:15672}/api"
AUTH="$RABBITMQ_USER:$RABBITMQ_PASSWORD"
COLAS="q.cmd.email q.cmd.kitchen q.cmd.invoice q.cmd.email.dlq q.cmd.kitchen.dlq q.cmd.invoice.dlq"
FALLOS=0

ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
api()   { curl -s -m 15 -u "$AUTH" "$@"; }
vaciar() { for q in $COLAS; do api -X DELETE "$MQ_API/queues/%2F/$q/contents" >/dev/null; done; }
publicar() { # exchange clave
  api -X POST "$MQ_API/exchanges/%2F/$1/publish" -H 'content-type: application/json' \
    -d "{\"properties\":{\"delivery_mode\":2},\"routing_key\":\"$2\",\"payload\":\"{\\\"prueba\\\":\\\"$2\\\"}\",\"payload_encoding\":\"string\"}"
}
contar() { api -X POST "$MQ_API/queues/%2F/$1/get" -H 'content-type: application/json' \
  -d '{"count":50,"ackmode":"ack_requeue_true","encoding":"auto"}' | grep -o '"routing_key"' | wc -l; }
# Dónde cayó el mensaje: lista las colas que tienen mensajes
donde() { local r=""; for q in $COLAS; do [ "$(contar $q)" -gt 0 ] && r="$r $q"; done; echo "${r# }"; }

esperado() { # exchange clave cola_esperada
  vaciar
  local resp; resp=$(publicar "$1" "$2")
  local cae; cae=$(donde)
  if [ "$cae" = "$3" ]; then ok "$1 + '$2' -> solo $3"
  else fallo "$1 + '$2' -> cayó en [${cae:-ninguna}], se esperaba [$3] (respuesta: $resp)"; fi
}

echo "1) Clúster"
nodos=$(api "$MQ_API/nodes")
n=$(echo "$nodos" | grep -o '"running":true' | wc -l)
nombres=$(echo "$nodos" | grep -o '"name":"rabbit@[a-z0-9]*"' | sort -u | cut -d'"' -f4 | tr '\n' ' ')
[ "$n" -ge 2 ] && ok "$n nodos activos en el clúster: $nombres" || fallo "solo $n nodo(s) activo(s): $nombres"
echo "$nodos" | grep -q 'rabbit@rabbit1' && echo "$nodos" | grep -q 'rabbit@rabbit2' && ok "rabbit1 y rabbit2 son miembros del mismo clúster" || fallo "falta rabbit1 o rabbit2 en el clúster"

echo "2) Topología cargada"
ex=$(api "$MQ_API/exchanges/%2F")
for par in "cmd.direct:direct" "cmd.topic:topic" "cmd.dead.dlx:direct"; do
  nombre=${par%%:*}; tipo=${par##*:}
  echo "$ex" | grep -o "\"name\":\"$nombre\"[^}]*\"type\":\"$tipo\"" >/dev/null && ok "exchange $nombre ($tipo)" || fallo "no está el exchange $nombre de tipo $tipo"
done
for q in $COLAS; do
  info=$(api "$MQ_API/queues/%2F/$q")
  if echo "$info" | grep -q "\"name\":\"$q\""; then
    dur=$(echo "$info" | grep -o '"durable":true' | head -1)
    [ -n "$dur" ] && ok "cola $q (durable)" || fallo "la cola $q no es durable"
  else fallo "falta la cola $q"; fi
done
for q in q.cmd.email q.cmd.kitchen q.cmd.invoice; do
  info=$(api "$MQ_API/queues/%2F/$q")
  echo "$info" | grep -q '"x-dead-letter-exchange":"cmd.dead.dlx"' && ok "$q -> DLX cmd.dead.dlx ($(echo "$info" | grep -o '"x-dead-letter-routing-key":"[^"]*"' | cut -d'"' -f4))" || fallo "$q no tiene x-dead-letter-exchange"
done
# Se cuentan solo los bindings de los exchanges cmd.* (cada cola tiene además uno implícito al exchange por defecto)
nb=$(api "$MQ_API/bindings/%2F" | grep -o '"source":"cmd\.[a-z.]*"' | wc -l)
[ "$nb" -eq 11 ] && ok "bindings declarados: $nb (los 9 del enunciado + email.send.* e invoice.gen.* para que las variantes lleguen)" || fallo "hay $nb bindings de cmd.*, se esperaban 11"
api "$MQ_API/policies/%2F" | grep -q '"name":"ha-all"' && ok "política ha-all (colas replicadas en los dos nodos)" || fallo "falta la política ha-all"
# Que la política exista no basta: cada cola debe tener de verdad un espejo sincronizado en el otro nodo.
# (las estadísticas de la API tardan unos segundos en reflejarlo)
for q in $COLAS; do
  espejo=""
  for _ in 1 2 3 4 5 6; do
    espejo=$(api "$MQ_API/queues/%2F/$q" | grep -o '"synchronised_slave_nodes":\["rabbit@[a-z0-9]*"' | cut -d'"' -f4)
    [ -n "$espejo" ] && break
    sleep 5
  done
  [ -n "$espejo" ] && ok "$q tiene espejo sincronizado en $espejo" || fallo "$q NO tiene espejo: si cae su nodo, se pierde"
done

echo "3) Enrutamiento por cmd.direct (clave exacta)"
esperado cmd.direct email.send q.cmd.email
esperado cmd.direct kitchen.ticket q.cmd.kitchen
esperado cmd.direct invoice.gen q.cmd.invoice
vaciar
r=$(publicar cmd.direct clave.sin.binding)
[ "$(donde)" = "" ] && echo "$r" | grep -q '"routed":false' && ok "cmd.direct + 'clave.sin.binding' -> no llega a ninguna cola (routed=false)" || fallo "una clave sin binding llegó a alguna cola o fue enrutada: $r"

echo "4) Enrutamiento por cmd.topic (patrones)"
esperado cmd.topic email.send q.cmd.email
esperado cmd.topic email.send.high q.cmd.email
esperado cmd.topic kitchen.ticket q.cmd.kitchen
esperado cmd.topic kitchen.ticket.thermal q.cmd.kitchen
esperado cmd.topic invoice.gen q.cmd.invoice
esperado cmd.topic invoice.gen.pdf q.cmd.invoice

echo "5) Cola de mensajes fallidos: un mensaje rechazado va a su DLQ por cmd.dead.dlx"
for par in "email.send:q.cmd.email:q.cmd.email.dlq" "kitchen.ticket:q.cmd.kitchen:q.cmd.kitchen.dlq" "invoice.gen:q.cmd.invoice:q.cmd.invoice.dlq"; do
  clave=${par%%:*}; resto=${par#*:}; cola=${resto%%:*}; dlq=${resto##*:}
  vaciar
  publicar cmd.direct "$clave" >/dev/null
  # NACK sin reencolar: es lo que hace un consumidor cuando agota los reintentos. La API HTTP del panel
  # a veces cierra el canal antes de que se procese el rechazo y el mensaje vuelve a la cola (marcado
  # redelivered): en ese caso no hubo rechazo y se repite, hasta 5 veces.
  en_dlq=""
  for _ in 1 2 3 4 5; do
    api -X POST "$MQ_API/queues/%2F/$cola/get" -H 'content-type: application/json' -d '{"count":1,"ackmode":"reject_requeue_false","encoding":"auto"}' >/dev/null
    for _ in $(seq 1 6); do
      sleep 1
      en_dlq=$(api -X POST "$MQ_API/queues/%2F/$dlq/get" -H 'content-type: application/json' -d '{"count":5,"ackmode":"ack_requeue_true","encoding":"auto"}')
      echo "$en_dlq" | grep -q '"routing_key"' && break
    done
    echo "$en_dlq" | grep -q '"routing_key"' && break
  done
  if echo "$en_dlq" | grep -q '"routing_key"' && [ "$(contar $cola)" = "0" ]; then
    motivo=$(echo "$en_dlq" | grep -o '"reason":"[a-z]*"' | head -1 | cut -d'"' -f4)
    ok "$cola -> $dlq (motivo en x-death: ${motivo:-?}); la cola principal quedó vacía"
  else fallo "el mensaje rechazado de $cola no llegó a $dlq"; fi
done

vaciar
echo
[ "$FALLOS" -eq 0 ] && echo "Todo OK" || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
