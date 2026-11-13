#!/bin/bash
# Verifica el clúster Kafka de Clean&Fresh (Spec 044): Zookeeper de 3 nodos, 3 brokers, los tópicos del sistema con sus parámetros,
# réplicas sincronizadas y un envío y lectura de prueba con acks=all. Opcionalmente también el administrador y los servicios.
#
# Uso (en la carpeta kafka/, donde está el docker-compose.yml):
#   ./verificar-kafka.sh                      # el clúster
#   ./verificar-kafka.sh --caida              # además detiene un broker y comprueba que el sistema sigue (y lo vuelve a levantar)
#   ./verificar-kafka.sh --solo-apps          # solo el administrador y los consumidores, por HTTP (sin docker): para correrlo en la EC2 de los microservicios
#   KAFKA_ADMIN_URL=http://localhost:8087 REPORTES_URL=http://localhost:8084 AUDITORIA_URL=http://localhost:8085 ./verificar-kafka.sh
#
# Usa un tópico temporal (verificacion.tmp) que crea y elimina; no toca los tópicos del sistema ni sus mensajes.
set -u
cd "$(dirname "$0")"
DC="docker compose"
BOOT="kafka1:29092,kafka2:29092,kafka3:29092"
TEMP_TOPIC="verificacion.tmp"
FALLOS=0
CAIDA=0
SOLO_APPS=0
[ "${1:-}" = "--caida" ] && CAIDA=1
[ "${1:-}" = "--solo-apps" ] && SOLO_APPS=1

ok()    { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
kafka() { $DC exec -T kafka1 "$@" 2>/dev/null; }          # ejecuta un comando de Kafka dentro de kafka1
describir() { kafka kafka-topics --bootstrap-server "$BOOT" --describe --topic "$1"; }

if [ "$SOLO_APPS" = 0 ]; then
echo "1) Zookeeper: 3 nodos, un líder y dos seguidores"
lider=0; seguidores=0
for z in zk1 zk2 zk3; do
  modo=$($DC exec -T $z bash -c 'echo srvr | nc localhost 2181 | grep Mode' 2>/dev/null | awk '{print $2}')
  case "$modo" in leader) lider=$((lider+1));; follower) seguidores=$((seguidores+1));; esac
done
[ "$lider" = 1 ] && [ "$seguidores" = 2 ] && ok "1 líder y 2 seguidores" || fallo "se esperaba 1 líder y 2 seguidores (hay $lider y $seguidores)"

echo "2) Brokers: 3 en el clúster"
ids=$(kafka kafka-broker-api-versions --bootstrap-server "$BOOT" | grep -o "kafka[0-9]:29092 (id: [0-9]*" | sort -u)
n=$(echo "$ids" | grep -c "kafka")
[ "$n" = 3 ] && ok "3 brokers: $(echo "$ids" | sed 's/:29092 (id: /=/' | tr '\n' ' ')" || fallo "se esperaban 3 brokers y hay $n"

echo "3) Tópicos del sistema: 3 particiones, 3 réplicas, política y retención"
comprobar() { # topico politica retencion_ms
  local d; d=$(describir "$1")
  local p r
  p=$(echo "$d" | grep -o 'PartitionCount: [0-9]*' | head -1 | awk '{print $2}')
  r=$(echo "$d" | grep -o 'ReplicationFactor: [0-9]*' | head -1 | awk '{print $2}')
  if [ "$p" = 3 ] && [ "$r" = 3 ] && echo "$d" | grep -q "cleanup.policy=$2" && echo "$d" | grep -q "retention.ms=$3" && echo "$d" | grep -q "min.insync.replicas=2"; then
    ok "$1: 3 particiones, 3 réplicas, $2, retención $3 ms, min.insync.replicas=2"
  else fallo "$1: particiones=$p réplicas=$r (se esperaba 3/3, $2, $3 ms)"; fi
}
comprobar orders.events delete 604800000
comprobar audit.timeline "compact,delete" 2592000000
for t in orders.events.reportes.DLT orders.events.auditoria.DLT audit.timeline.auditoria.DLT; do comprobar $t delete 1209600000; done

echo "4) Réplicas sincronizadas"
sub=$(kafka kafka-topics --bootstrap-server "$BOOT" --describe --under-replicated-partitions | grep -c "Partition:")
[ "$sub" = 0 ] && ok "ninguna partición con réplicas sin sincronizar" || fallo "$sub partición(es) con réplicas sin sincronizar"

echo "5) Envío y lectura con acks=all (tópico temporal)"
kafka kafka-topics --bootstrap-server "$BOOT" --delete --topic $TEMP_TOPIC >/dev/null 2>&1
kafka kafka-topics --bootstrap-server "$BOOT" --create --topic $TEMP_TOPIC --partitions 3 --replication-factor 3 --config min.insync.replicas=2 >/dev/null
echo "clave-1:prueba-de-verificacion" | $DC exec -T kafka1 kafka-console-producer --bootstrap-server "$BOOT" --topic $TEMP_TOPIC \
  --producer-property acks=all --property parse.key=true --property key.separator=: >/dev/null 2>&1
leido=$(kafka kafka-console-consumer --bootstrap-server "$BOOT" --topic $TEMP_TOPIC --from-beginning --max-messages 1 --timeout-ms 15000)
[ "$leido" = "prueba-de-verificacion" ] && ok "un mensaje publicado con acks=all se leyó de vuelta" || fallo "no se pudo leer el mensaje de prueba (leído: '$leido')"

if [ "$CAIDA" = 1 ]; then
  echo "6) Caída de un broker: el sistema sigue"
  $DC stop kafka3 >/dev/null 2>&1
  sleep 10
  echo "clave-2:con-un-broker-caido" | $DC exec -T kafka1 kafka-console-producer --bootstrap-server kafka1:29092,kafka2:29092 --topic $TEMP_TOPIC \
    --producer-property acks=all --property parse.key=true --property key.separator=: >/dev/null 2>&1
  leidos=$($DC exec -T kafka1 kafka-console-consumer --bootstrap-server kafka1:29092,kafka2:29092 --topic $TEMP_TOPIC --from-beginning --max-messages 2 --timeout-ms 15000 2>/dev/null | sort | tr '\n' ' ')
  echo "$leidos" | grep -q "con-un-broker-caido" && echo "$leidos" | grep -q "prueba-de-verificacion" \
    && ok "con kafka3 detenido se publicó y se leyó (acks=all con min.insync.replicas=2): $leidos" || fallo "con kafka3 detenido no funcionó (leído: '$leidos')"
  $DC start kafka3 >/dev/null 2>&1
  for _ in $(seq 1 30); do
    sub=$(kafka kafka-topics --bootstrap-server "$BOOT" --describe --under-replicated-partitions | grep -c "Partition:")
    [ "$sub" = 0 ] && break; sleep 4
  done
  [ "$sub" = 0 ] && ok "kafka3 volvió y se resincronizó (sin particiones sub-replicadas)" || fallo "kafka3 no terminó de resincronizarse ($sub partición(es))"
fi

kafka kafka-topics --bootstrap-server "$BOOT" --delete --topic $TEMP_TOPIC >/dev/null 2>&1
fi   # fin de las comprobaciones del clúster (se omiten con --solo-apps)

if [ -n "${KAFKA_ADMIN_URL:-}" ]; then
  echo "7) Administrador de Kafka ($KAFKA_ADMIN_URL)"
  nb=$(curl -s -m 15 "$KAFKA_ADMIN_URL/api/kafka/cluster" | grep -o '"id":' | wc -l)
  [ "$nb" = 3 ] && ok "GET /api/kafka/cluster ve los 3 brokers" || fallo "el administrador ve $nb broker(es)"
  nt=$(curl -s -m 15 "$KAFKA_ADMIN_URL/api/kafka/topics" | grep -o '"nombre":"\(orders.events\|audit.timeline\)[^"]*"' | wc -l)
  [ "$nt" -ge 5 ] && ok "GET /api/kafka/topics lista los tópicos del sistema ($nt)" || fallo "el administrador lista solo $nt de los 5 tópicos del sistema"
  code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST "$KAFKA_ADMIN_URL/api/kafka/topologia/base")
  [ "$code" = 200 ] && ok "POST /api/kafka/topologia/base es idempotente (200)" || fallo "POST /api/kafka/topologia/base respondió $code"
fi

if [ -n "${REPORTES_URL:-}" ] && [ -n "${AUDITORIA_URL:-}" ]; then
  echo "8) Consumidores"
  for par in "reportes-kpis:$REPORTES_URL" "auditoria-registro:$AUDITORIA_URL"; do
    grupo=${par%%:*}; url=${par#*:}
    estado=$(curl -s -m 15 "$KAFKA_ADMIN_URL/api/kafka/groups/$grupo" | grep -o '"estado":"[A-Za-z]*"' | head -1 | cut -d'"' -f4)
    lag=$(curl -s -m 15 "$KAFKA_ADMIN_URL/api/kafka/groups/$grupo" | grep -o '"lagTotal":[0-9]*' | cut -d: -f2)
    [ "$estado" = Stable ] && [ "${lag:-1}" = 0 ] && ok "grupo $grupo: Stable, lag 0" || fallo "grupo $grupo: estado '${estado:-?}', lag '${lag:-?}'"
  done
fi

echo
[ "$FALLOS" -eq 0 ] && echo "Todo OK" || { echo "$FALLOS comprobación(es) fallaron"; exit 1; }
