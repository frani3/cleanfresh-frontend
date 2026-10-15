#!/bin/bash
# Verifica el administrador de RabbitMQ (ms-cleanfresh-mq-admin, Spec 033 fase 3) contra el clúster real:
# lo que crea o elimina se comprueba mirando directamente la API del panel de RabbitMQ, no solo lo que
# responde el propio administrador.
# Uso (en la carpeta mq/, con el .env, con el administrador en :8086 y RabbitMQ arriba):
#   ./verificar-admin.sh
# Crea y elimina objetos de prueba (cmd.demo, q.demo.pagos); deja la topología como estaba.
set -u
cd "${MQ_DIR:-$(dirname "$0")}"
set -a; . ./.env; set +a

ADMIN="${ADMIN_URL:-http://localhost:8086}/api/mq"
MQ_API="${MQ_API:-http://localhost:15672}/api"
AUTH="$RABBITMQ_USER:$RABBITMQ_PASSWORD"
TMP="$(mktemp -d)"
FALLOS=0

ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
titulo() { printf '\n\033[1m%s\033[0m\n' "$1"; }
panel() { curl -s -m 20 -u "$AUTH" "$@"; }
adm()   { curl -s -m 30 "$@"; }
codigo() { curl -s -m 30 -o /dev/null -w '%{http_code}' "$@"; }
esperar() { local limite=${2:-20} i=0; while [ $i -lt $limite ]; do eval "$1" >/dev/null 2>&1 && return 0; sleep 1; i=$((i+1)); done; return 1; }

titulo "1) Topología base (la que dejó la fase 1)"
adm "$ADMIN/topologia" > "$TMP/t.json"
[ "$(grep -o 'rabbit@rabbit[12] (activo)' "$TMP/t.json" | wc -l)" = "2" ] && ok "los dos nodos aparecen activos" || fallo "nodos: $(grep -o '"nodos":\[[^]]*\]' "$TMP/t.json")"
[ "$(grep -o '"exchange":"cmd\.[a-z.]*"' "$TMP/t.json" | wc -l)" = "11" ] && ok "11 bindings de los exchanges cmd.*" || fallo "bindings: $(grep -o '"exchange":"cmd\.[a-z.]*"' "$TMP/t.json" | wc -l)"
[ "$(grep -o '"nombre":"q\.cmd\.[a-z.]*"' "$TMP/t.json" | wc -l)" = "6" ] && ok "las 6 colas q.cmd.*" || fallo "no están las 6 colas"
grep -q '"nombre":"cmd.direct","tipo":"direct"' "$TMP/t.json" && grep -q '"nombre":"cmd.topic","tipo":"topic"' "$TMP/t.json" && grep -q '"nombre":"cmd.dead.dlx","tipo":"direct"' "$TMP/t.json" && ok "los 3 exchanges con su tipo" || fallo "faltan exchanges"
grep -q '"nombre":"q.cmd.email","durable":true,"dlq":false,"exchangeMuertos":"cmd.dead.dlx","claveMuertos":"email.send"' "$TMP/t.json" && ok "q.cmd.email muestra su DLX y su clave de DLQ" || fallo "q.cmd.email sin DLX en la topología"

titulo "2) Crear un exchange, una cola con DLQ y un binding"
[ "$(codigo -X POST "$ADMIN/exchanges/cmd.demo" -H 'Content-Type: application/json' -d '{"tipo":"topic"}')" = "200" ] && ok "POST /exchanges/cmd.demo (topic)" || fallo "no se creó el exchange"
[ "$(codigo -X POST "$ADMIN/queues/q.demo.pagos")" = "200" ] && ok "POST /queues/q.demo.pagos (con DLQ por defecto)" || fallo "no se creó la cola"
[ "$(codigo -X POST "$ADMIN/bindings" -H 'Content-Type: application/json' -d '{"exchange":"cmd.demo","cola":"q.demo.pagos","clave":"pagos.#"}')" = "200" ] && ok "POST /bindings (cmd.demo -> q.demo.pagos, pagos.#)" || fallo "no se creó el binding"
echo "       en el panel de RabbitMQ:"
panel "$MQ_API/exchanges/%2F/cmd.demo" | grep -q '"type":"topic"' && ok "el exchange cmd.demo existe y es topic" || fallo "cmd.demo no está en el panel"
panel "$MQ_API/queues/%2F/q.demo.pagos" | grep -q '"x-dead-letter-exchange":"cmd.dead.dlx"' && ok "q.demo.pagos existe con x-dead-letter-exchange = cmd.dead.dlx" || fallo "q.demo.pagos sin DLX en el panel"
panel "$MQ_API/queues/%2F/q.demo.pagos.dlq" | grep -q '"name":"q.demo.pagos.dlq"' && ok "q.demo.pagos.dlq existe" || fallo "no existe la DLQ"
panel "$MQ_API/bindings/%2F/e/cmd.dead.dlx/q/q.demo.pagos.dlq" | grep -q '"routing_key":"q.demo.pagos"' && ok "la DLQ está enlazada a cmd.dead.dlx" || fallo "la DLQ no está enlazada"
adm "$ADMIN/topologia" | grep -q '"exchange":"cmd.demo","cola":"q.demo.pagos","clave":"pagos.#"' && ok "GET /topologia lo muestra" || fallo "/topologia no muestra el binding nuevo"

titulo "3) El binding enruta de verdad; al eliminarlo deja de enrutar"
panel -X POST "$MQ_API/exchanges/%2F/cmd.demo/publish" -H 'content-type: application/json' -d '{"properties":{},"routing_key":"pagos.cobrar.hoy","payload":"x","payload_encoding":"string"}' | grep -q '"routed":true' && ok "pagos.cobrar.hoy llega a la cola (pagos.# acepta varias palabras)" || fallo "el mensaje no se enrutó"
[ "$(codigo -X DELETE "$ADMIN/bindings" -H 'Content-Type: application/json' -d '{"exchange":"cmd.demo","cola":"q.demo.pagos","clave":"pagos.#"}')" = "200" ] && ok "DELETE /bindings (la clave tiene un #)" || fallo "no se eliminó el binding"
panel -X POST "$MQ_API/exchanges/%2F/cmd.demo/publish" -H 'content-type: application/json' -d '{"properties":{},"routing_key":"pagos.cobrar.hoy","payload":"x","payload_encoding":"string"}' | grep -q '"routed":false' && ok "sin el binding el mensaje ya no se enruta" || fallo "sigue enrutando"
[ "$(codigo -X DELETE "$ADMIN/bindings" -H 'Content-Type: application/json' -d '{"exchange":"cmd.demo","cola":"q.demo.pagos","clave":"pagos.#"}')" = "404" ] && ok "eliminarlo otra vez responde 404" || fallo "no respondió 404"

titulo "4) Solicitudes inválidas se rechazan"
[ "$(codigo -X POST "$ADMIN/queues/nombre%20con%20espacio")" = "400" ] && ok "nombre de cola con espacios: 400" || fallo "esperaba 400"
[ "$(codigo -X POST "$ADMIN/exchanges/cmd.x" -H 'Content-Type: application/json' -d '{"tipo":"fanout"}')" = "400" ] && ok "tipo fanout: 400 (solo direct o topic)" || fallo "esperaba 400"
[ "$(codigo -X POST "$ADMIN/exchanges/amq.direct" -H 'Content-Type: application/json' -d '{"tipo":"direct"}')" = "400" ] && ok "tocar un exchange del sistema (amq.*): 400" || fallo "esperaba 400"
[ "$(codigo -X DELETE "$ADMIN/queues/q.no.existe")" = "404" ] && ok "eliminar una cola que no existe: 404" || fallo "esperaba 404"
[ "$(codigo -X POST "$ADMIN/queues/q.cmd.email" -H 'Content-Type: application/json' -d '{"conDlq":false}')" = "400" ] && ok "redeclarar q.cmd.email con otros argumentos lo rechaza el broker: 400" || fallo "esperaba 400"

titulo "5) Eliminar lo creado"
[ "$(codigo -X DELETE "$ADMIN/queues/q.demo.pagos?conDlq=true")" = "200" ] && ok "DELETE /queues/q.demo.pagos?conDlq=true" || fallo "no se eliminó la cola"
[ "$(codigo -X DELETE "$ADMIN/exchanges/cmd.demo")" = "200" ] && ok "DELETE /exchanges/cmd.demo" || fallo "no se eliminó el exchange"
[ "$(panel -o /dev/null -w '%{http_code}' "$MQ_API/queues/%2F/q.demo.pagos")" = "404" ] && [ "$(panel -o /dev/null -w '%{http_code}' "$MQ_API/queues/%2F/q.demo.pagos.dlq")" = "404" ] && ok "las dos colas ya no están en el panel" || fallo "siguen las colas en el panel"
[ "$(panel -o /dev/null -w '%{http_code}' "$MQ_API/exchanges/%2F/cmd.demo")" = "404" ] && ok "el exchange ya no está en el panel" || fallo "sigue el exchange"

titulo "6) Topología base: idempotente y repara lo que falte"
[ "$(codigo -X POST "$ADMIN/topologia/base")" = "200" ] && [ "$(codigo -X POST "$ADMIN/topologia/base")" = "200" ] && ok "se declara dos veces seguidas sin error" || fallo "la topología base falló"
[ "$(adm "$ADMIN/topologia" | grep -o '"exchange":"cmd\.[a-z.]*"' | wc -l)" = "11" ] && ok "siguen siendo 11 bindings (no se duplican)" || fallo "cambió el número de bindings"
[ "$(codigo -X DELETE "$ADMIN/bindings" -H 'Content-Type: application/json' -d '{"exchange":"cmd.topic","cola":"q.cmd.email","clave":"email.*"}')" = "200" ] && ok "se elimina a mano el binding cmd.topic -> q.cmd.email (email.*)" || fallo "no se pudo eliminar email.*"
panel -X POST "$MQ_API/exchanges/%2F/cmd.topic/publish" -H 'content-type: application/json' -d '{"properties":{},"routing_key":"email.otro","payload":"x","payload_encoding":"string"}' | grep -q '"routed":false' && ok "ahora email.otro no se enruta" || fallo "email.otro sigue enrutando"
codigo -X POST "$ADMIN/topologia/base" >/dev/null
panel -X POST "$MQ_API/exchanges/%2F/cmd.topic/publish" -H 'content-type: application/json' -d '{"properties":{},"routing_key":"email.otro","payload":"x","payload_encoding":"string"}' | grep -q '"routed":true' && ok "tras declarar la base, email.otro vuelve a enrutarse" || fallo "la base no restituyó el binding"
panel -X DELETE "$MQ_API/queues/%2F/q.cmd.email/contents" >/dev/null
panel "$MQ_API/policies/%2F/ha-all" | grep -q '"ha-mode":"all"' && ok "la política de alta disponibilidad ha-all sigue aplicada" || fallo "falta la política ha-all"

titulo "7) Métricas y alerta de DLQ"
adm "$ADMIN/metricas" | grep -q '"hayAlerta":false' && ok "con las DLQ vacías no hay alerta" || fallo "hay alerta con las DLQ vacías (¿quedan mensajes muertos?)"
panel -X POST "$MQ_API/exchanges/%2F/cmd.dead.dlx/publish" -H 'content-type: application/json' -d '{"properties":{"delivery_mode":2},"routing_key":"invoice.gen","payload":"mensaje muerto de prueba","payload_encoding":"string"}' | grep -q '"routed":true' && ok "se deja un mensaje en q.cmd.invoice.dlq" || fallo "no se pudo dejar el mensaje en la DLQ"
esperar "adm $ADMIN/metricas | grep -q '\"hayAlerta\":true'" 25 && ok "las métricas avisan: $(adm "$ADMIN/metricas" | grep -o '"alertas":\[[^]]*\]')" || fallo "no apareció la alerta"
panel -X DELETE "$MQ_API/queues/%2F/q.cmd.invoice.dlq/contents" >/dev/null
esperar "adm $ADMIN/metricas | grep -q '\"hayAlerta\":false'" 60 && ok "vaciada la DLQ, la alerta desaparece" || fallo "la alerta no se fue"

titulo "8) Swagger / OpenAPI"
adm "${ADMIN_URL:-http://localhost:8086}/v3/api-docs" | grep -q '/api/mq/topologia' && ok "/v3/api-docs documenta los endpoints" || fallo "no hay documentación OpenAPI"
[ "$(codigo -L "${ADMIN_URL:-http://localhost:8086}/swagger-ui.html")" = "200" ] && ok "/swagger-ui.html responde" || fallo "swagger-ui no responde"

rm -rf "$TMP"
echo
[ "$FALLOS" -eq 0 ] && echo "Todo OK" || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
