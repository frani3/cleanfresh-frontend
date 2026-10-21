#!/usr/bin/env bash
# Demostración de las notificaciones con RabbitMQ (Spec 038), en los dos sentidos y con el servicio caído:
#   1. Quién consume: ms-cleanfresh-notificaciones aparece por su nombre en RabbitMQ.
#   2. Cliente -> Operador: el cliente solicita un servicio y el Operador recibe el aviso.
#   3. Cliente -> Operador con el servicio de notificaciones CAÍDO: el mensaje queda guardado en RabbitMQ y,
#      cuando el servicio vuelve, el Operador recibe el aviso.
#   4. Operador -> Cliente: el Operador cambia el estado y el Cliente recibe el aviso.
#   5. Operador -> Cliente con el servicio CAÍDO: lo mismo, el aviso espera y llega al volver.
#
# Uso (en la EC2 de microservicios):   ./demo-notificaciones.sh
#       con pausas para mostrar la consola:  ./demo-notificaciones.sh --pausas   (usar `ssh -t`)
# Detiene `notificaciones` dos veces y lo deja levantado al final. Crea dos órdenes de prueba
# (cliente "Demo-Prof-HHMMSS") y las deja en ACEPTADO / EN_PREPARACION.
# Lee las colas por la API de administración de RabbitMQ (RABBITMQ_MGMT_URLS del .env); requiere python3.
set -u
cd "${DESPLIEGUE_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

PAUSAS=0; [ "${1:-}" = "--pausas" ] && PAUSAS=1
MQ_API="${RABBITMQ_MGMT_URLS%%,*}"
SERVICIO=notificaciones
PASO=0; FALLOS=0

paso()  { PASO=$((PASO+1)); printf '\n\033[1m[%s] %s\033[0m\n' "$PASO" "$1"; }
ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
info()  { printf '       %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
pausa() { [ "$PAUSAS" = "1" ] && { printf '       \033[2m(mira la consola de RabbitMQ y la app; Enter para seguir)\033[0m '; read -r _; }; return 0; }
esperar() { local limite=${2:-30} i=0; while [ "$i" -lt "$limite" ]; do eval "$1" >/dev/null 2>&1 && return 0; sleep 1; i=$((i+1)); done; return 1; }

api() { curl -s -m 10 -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" "$MQ_API/$1"; }
# cola -> mensajes (listos + sin confirmar), persistentes y consumidores
campo() { api "queues/%2F/$1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('$2', 0))" 2>/dev/null; }
mensajes() { campo "$1" messages; }
consumidores() { campo "$1" consumers; }
colas() {
  local q linea=""
  for q in q.cmd.email q.cmd.kitchen q.cmd.invoice; do
    linea="$linea $q: $(mensajes $q) mensaje(s) ($(campo $q messages_persistent) persistentes), $(consumidores $q) consumidor(es);"
  done
  info "RabbitMQ ->$linea"
}
quien_consume() {
  api consumers | python3 -c "
import sys, json
c = sorted(json.load(sys.stdin), key=lambda c: c['queue']['name'])
if not c: print('       (ningún consumidor conectado)')
for x in c: print('       consumidor', x['consumer_tag'].ljust(46), 'cola', x['queue']['name'].ljust(14), '| ACK manual:', x['ack_required'])" 2>/dev/null
  api connections | python3 -c "
import sys, json
for x in json.load(sys.stdin): print('       conexión  ', str(x.get('user_provided_name')).ljust(30), 'desde', x['peer_host'])" 2>/dev/null
}

# avisos (API del microservicio de notificaciones; cae con él)
avisos_sucursal() { curl -s -m 5 "localhost:8083/api/notificaciones?sucursal=Providencia"; }
avisos_cliente() { curl -s -m 5 "localhost:8083/api/notificaciones?cliente=$CLIENTE"; }
servicio_arriba() { [ "$(curl -s -o /dev/null -m 3 -w '%{http_code}' localhost:8083/api/notificaciones)" = "200" ]; }
crear_orden() { # servicio -> imprime el número
  curl -s -m 20 -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
    -d "{\"cliente\":\"$CLIENTE\",\"clienteNombre\":\"$CLIENTE@cleanfresh.com\",\"servicio\":\"$1\",\"total\":9500,\"sucursal\":\"Providencia\"}" | grep -o 'ORD-[0-9]*' | head -1
}
cambiar_estado() { curl -s -o /dev/null -m 20 -w '%{http_code}' -X PUT "localhost:8081/api/orders/$1/estado" -H 'Content-Type: application/json' -d "{\"estado\":\"$2\"}"; }
detener() { docker compose stop "$SERVICIO" >/dev/null 2>&1; }
levantar() {
  docker compose start "$SERVICIO" >/dev/null 2>&1
  printf '       esperando a que arranque'
  for _ in $(seq 1 45); do servicio_arriba && break; printf '.'; sleep 3; done; echo
}

CLIENTE="Demo-Prof-$(date +%H%M%S)"

paso "Quién consume: ms-cleanfresh-notificaciones responde a RabbitMQ"
quien_consume
n=$(api consumers | grep -o 'ms-cleanfresh-notificaciones\.q\.cmd\.[a-z]*' | sort -u | wc -l)
[ "$n" = "3" ] && ok "las 3 colas de comandos tienen a ms-cleanfresh-notificaciones como consumidor (con ACK manual)" || fallo "se esperaban 3 consumidores de ms-cleanfresh-notificaciones y hay $n"
colas
info "En la consola: Queues -> q.cmd.email -> Consumers, y la pestaña Connections."
pausa

paso "Cliente -> Operador: el cliente solicita un servicio y el Operador recibe el aviso"
N1=$(crear_orden "Planchado")
[ -n "$N1" ] && ok "el cliente $CLIENTE solicitó un servicio: $N1 creada" || fallo "no se creó la orden"
if esperar "avisos_sucursal | grep -q 'Nuevo pedido $N1'" 40; then
  ok "el Operador de Providencia recibió: $(avisos_sucursal | grep -o "\"mensaje\":\"Nuevo pedido $N1[^\"]*" | sed 's/"mensaje":"//' | head -1)"
else fallo "no llegó el aviso al Operador por $N1"; fi
colas
pausa

paso "Se cae el servicio de notificaciones"
detener
if esperar "[ \"\$(consumidores q.cmd.email)\" = 0 ]" 40; then ok "RabbitMQ ya no ve a ms-cleanfresh-notificaciones: q.cmd.email sin consumidores"; else fallo "q.cmd.email sigue con consumidores"; fi
servicio_arriba && fallo "el servicio sigue respondiendo" || ok "el servicio no responde (puerto 8083 caído)"
quien_consume
pausa

paso "Cliente -> Operador con el servicio caído: el mensaje queda guardado en RabbitMQ"
N2=$(crear_orden "Lavado en seco")
[ -n "$N2" ] && ok "el cliente solicitó otro servicio y la orden $N2 se aceptó (el sistema no depende de notificaciones)" || fallo "no se creó la orden con el servicio caído"
if esperar "[ \"\$(mensajes q.cmd.email)\" -ge 1 ] && [ \"\$(mensajes q.cmd.kitchen)\" -ge 1 ]" 40; then
  ok "los comandos de $N2 esperan en las colas, sin consumidor"
else fallo "no aparecieron mensajes esperando en q.cmd.email y q.cmd.kitchen"; fi
colas
info "En la consola: Queues -> Ready = 1; q.cmd.email -> Get messages (Nack message requeue true) muestra el JSON."
pausa

paso "Vuelve el servicio: el Operador recibe la notificación que esperaba"
levantar
servicio_arriba && ok "notificaciones volvió a responder" || fallo "notificaciones no volvió a levantar"
if esperar "avisos_sucursal | grep -q 'Nuevo pedido $N2'" 60; then
  ok "el Operador de Providencia recibió el aviso que había quedado guardado: $(avisos_sucursal | grep -o "\"mensaje\":\"Nuevo pedido $N2[^\"]*" | sed 's/"mensaje":"//' | head -1)"
else fallo "no llegó el aviso de $N2 al volver el servicio"; fi
esperar "[ \"\$(mensajes q.cmd.email)\" = 0 ] && [ \"\$(mensajes q.cmd.kitchen)\" = 0 ]" 40 && ok "las colas se vaciaron: el servicio consumió lo que esperaba" || fallo "las colas siguen con mensajes"
quien_consume
pausa

paso "Operador -> Cliente: el Operador cambia el estado y el Cliente recibe el aviso"
[ "$(cambiar_estado "$N1" ACEPTADO)" = "200" ] && ok "el Operador pasó $N1 a ACEPTADO" || fallo "no se pudo cambiar el estado de $N1"
if esperar "avisos_cliente | grep -q 'fue aceptado'" 40; then
  ok "el cliente $CLIENTE recibió: $(avisos_cliente | grep -o "\"mensaje\":\"Tu pedido $N1[^\"]*fue aceptado" | sed 's/"mensaje":"//' | head -1)"
else fallo "no llegó el aviso de cambio de estado al cliente"; fi
pausa

paso "Operador -> Cliente con el servicio caído: el aviso espera y llega al volver"
detener
esperar "[ \"\$(consumidores q.cmd.email)\" = 0 ]" 40 && ok "notificaciones caído (q.cmd.email sin consumidores)" || fallo "q.cmd.email sigue con consumidores"
[ "$(cambiar_estado "$N1" EN_PREPARACION)" = "200" ] && ok "el Operador pasó $N1 a EN_PREPARACION con el servicio caído (el cambio se guarda igual)" || fallo "no se pudo cambiar el estado con el servicio caído"
esperar "[ \"\$(mensajes q.cmd.email)\" -ge 1 ]" 40 && ok "el aviso para el cliente espera en q.cmd.email" || fallo "no apareció el aviso esperando en q.cmd.email"
colas
pausa
levantar
if esperar "avisos_cliente | grep -q 'está en preparación'" 60; then
  ok "el cliente recibió, al volver el servicio: $(avisos_cliente | grep -o "\"mensaje\":\"Tu pedido $N1[^\"]*está en preparación" | sed 's/"mensaje":"//' | head -1)"
else fallo "no llegó el aviso al cliente al volver el servicio"; fi
esperar "[ \"\$(mensajes q.cmd.email)\" = 0 ]" 40 && ok "q.cmd.email quedó vacía" || fallo "q.cmd.email sigue con mensajes"
n=$(avisos_cliente | grep -o '"numeroOrden":"'$N1'"' | wc -l)
[ "$n" = "2" ] && ok "el cliente tiene exactamente 2 avisos de $N1 (aceptado y en preparación), sin duplicados" || fallo "el cliente tiene $n avisos de $N1 (se esperaban 2)"

echo
if [ "$FALLOS" -eq 0 ]; then
  echo "Demostración completa: las notificaciones llegan en los dos sentidos y, aunque el servicio se caiga, RabbitMQ las conserva y se entregan al volver."
else
  echo "$FALLOS comprobación(es) fallaron"; exit 1
fi
