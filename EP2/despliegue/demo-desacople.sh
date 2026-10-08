#!/usr/bin/env bash
# Demostración del desacople con SQS (Spec 029/030): el cliente solicita un servicio
# mientras el microservicio de notificaciones está caído. La solicitud no se pierde:
# se guarda en orders, el mensaje espera en la cola de SQS y, cuando notificaciones
# vuelve a levantarse, lo recibe y genera el aviso.
#
# Uso (en la EC2 #2):  ./demo-desacople.sh
# Detiene `notificaciones` durante la demostración y lo deja levantado al final.
# Crea una orden de prueba en Providencia (cliente "Demo-Desacople-HHMMSS").
set -u
cd "${DESPLIEGUE_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

PASO=0
paso()  { PASO=$((PASO+1)); printf '\n\033[1m[%s] %s\033[0m\n' "$PASO" "$1"; }
ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
info()  { printf '       %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
FALLOS=0

# Mensajes de la cola, leídos directamente de AWS (visibles + en proceso). Se usa la AWS CLI
# en un contenedor con la red del host para tomar las credenciales del perfil de la EC2.
cola() {
  docker run --rm --network host amazon/aws-cli sqs get-queue-attributes \
    --queue-url "$SQS_QUEUE_URL" --region "${AWS_REGION:-us-east-1}" \
    --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
    --query 'Attributes.[ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible]' --output text 2>/dev/null
}
total_cola() { local r; r=$(cola) || return 1; [ -n "$r" ] || return 1; echo "$r" | awk '{print $1+$2}'; }
mostrar_cola() {
  local r; r=$(cola)
  if [ -n "$r" ]; then
    info "Cola SQS cleanfresh-ordenes -> mensajes disponibles: $(echo "$r" | awk '{print $1}'), en proceso: $(echo "$r" | awk '{print $2}')"
  else
    info "(no se pudo leer la cola desde aquí; míralo en la consola de AWS: SQS -> cleanfresh-ordenes)"
  fi
}
aviso_de() { curl -s "localhost:8083/api/notificaciones?sucursal=Providencia" | grep -o "\"mensaje\":\"Nuevo pedido $1[^\"]*" | sed 's/"mensaje":"//' | head -1; }

paso "Estado inicial: todo en marcha y la cola vacía"
docker compose ps --format '{{.Service}} {{.Status}}' | grep -E "^(orders|notificaciones) " | while read -r l; do info "$l"; done
mostrar_cola
base=$(total_cola || echo "")

paso "Se cae el microservicio de notificaciones"
docker compose stop notificaciones >/dev/null 2>&1
est=$(docker compose ps --format '{{.Service}} {{.Status}}' | grep "^notificaciones " || true)
[ -z "$est" ] || [[ "$est" != *"Up"* ]] && ok "notificaciones detenido (${est:-sin contenedor en ejecución})" || fallo "notificaciones sigue en ejecución: $est"
cod=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "localhost:8083/api/notificaciones")
[ "$cod" = "000" ] && ok "su puerto 8083 ya no responde" || fallo "el puerto 8083 responde HTTP $cod"

paso "El cliente solicita un servicio (POST /api/orders) con notificaciones caído"
marca="Demo-Desacople-$(date +%H%M%S)"
resp=$(curl -s -w '\nHTTP %{http_code}' -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
  -d "{\"cliente\":\"$marca\",\"servicio\":\"Lavado en seco\",\"total\":45000,\"sucursal\":\"Providencia\"}")
cod=$(echo "$resp" | tail -1 | grep -o '[0-9]*$')
num=$(echo "$resp" | grep -o 'ORD-[0-9]*' | head -1)
[ "$cod" = "201" ] && [ -n "$num" ] && ok "la solicitud se aceptó: $num creada (HTTP 201), aunque notificaciones está caído" || fallo "no se creó la orden (HTTP $cod): $resp"
if curl -s localhost:8081/api/orders | grep -q "\"numeroOrden\":\"$num\""; then ok "$num está guardada en la base de orders (RDS)"; else fallo "$num no aparece en orders"; fi

paso "El mensaje espera en la cola de SQS (nadie lo consume todavía)"
sleep 6
mostrar_cola
espera=$(total_cola || echo "")
if [ -n "$espera" ] && [ -n "$base" ]; then
  [ "$espera" -gt "$base" ] && ok "la cola pasó de $base a $espera mensaje(s): el pedido $num está esperando en SQS" || fallo "la cola no subió (antes $base, ahora $espera)"
else
  info "No se pudo medir la cola desde aquí; compruébalo en la consola de AWS (SQS -> cleanfresh-ordenes -> Mensajes disponibles)."
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

paso "Al volver, consume el mensaje que esperaba y genera el aviso"
a=""
for _ in $(seq 1 20); do a=$(aviso_de "$num"); [ -n "$a" ] && break; sleep 3; done
[ -n "$a" ] && ok "aviso generado para el Operador de Providencia: $a" || fallo "no apareció el aviso de $num"
# El contador de SQS es aproximado y fluctúa mientras se consume: se espera a que se estabilice.
fin=""
for _ in $(seq 1 25); do
  fin=$(total_cola || echo "")
  [ -n "$fin" ] && [ -n "$base" ] && [ "$fin" -le "$base" ] && break
  sleep 3
done
mostrar_cola
if [ -n "$fin" ] && [ -n "$base" ]; then
  [ "$fin" -le "$base" ] && ok "la cola volvió a $fin mensaje(s): el pedido se consumió y se eliminó de SQS" || fallo "la cola sigue en $fin (antes $base)"
fi
n=$(curl -s "localhost:8083/api/notificaciones?sucursal=Providencia" | grep -o "\"numeroOrden\":\"$num\"" | wc -l)
[ "$n" = "1" ] && ok "un solo aviso para $num (sin duplicados)" || fallo "hay $n avisos de $num (se esperaba 1)"

echo
[ "$FALLOS" -eq 0 ] && echo "Desacople demostrado: la solicitud sobrevivió a la caída y llegó cuando el servicio volvió." \
  || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
