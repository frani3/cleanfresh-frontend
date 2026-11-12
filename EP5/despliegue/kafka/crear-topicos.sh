#!/bin/bash
# Crea los tópicos de Clean&Fresh (Spec 044) y deja sus configuraciones como corresponde. Repetible.
# Lo ejecuta el contenedor kafka-init; también sirve a mano:
#   BOOTSTRAP=localhost:9092 bash crear-topicos.sh      (con kafka-topics y kafka-configs en el PATH)
set -eu
BOOTSTRAP="${BOOTSTRAP:-kafka1:29092,kafka2:29092,kafka3:29092}"

DIA_MS=86400000

# topico | politica | retencion (días) | configuraciones extra
topico() {
  local nombre="$1" politica="$2" dias="$3" extra="${4:-}"
  local retencion=$((dias * DIA_MS))
  local cfg="cleanup.policy=${politica},retention.ms=${retencion},min.insync.replicas=2"
  [ -n "$extra" ] && cfg="${cfg},${extra}"

  # Las comas dentro de un valor (compact,delete) se escapan con la sintaxis [a,b] de kafka-topics.
  local cfg_cli="${cfg/cleanup.policy=${politica}/cleanup.policy=[${politica}]}"

  if kafka-topics --bootstrap-server "$BOOTSTRAP" --describe --topic "$nombre" > /dev/null 2>&1; then
    echo "existe  $nombre: se corrigen sus configuraciones"
  else
    # kafka-topics no acepta varias configuraciones en un solo --config: se crea sin ellas y se aplican abajo con kafka-configs.
    kafka-topics --bootstrap-server "$BOOTSTRAP" --create --topic "$nombre" --partitions 3 --replication-factor 3 > /dev/null
    echo "creado  $nombre"
  fi
  kafka-configs --bootstrap-server "$BOOTSTRAP" --alter --entity-type topics --entity-name "$nombre" \
    --add-config "$cfg_cli" > /dev/null
}

# Eventos de negocio: fuente de verdad para reportes y auditoría. Se borran a los 7 días.
topico orders.events delete 7

# Línea de tiempo de auditoría: conserva el último registro por clave y borra lo viejo a los 30 días.
topico audit.timeline "compact,delete" 30 "segment.ms=3600000,min.cleanable.dirty.ratio=0.1,delete.retention.ms=86400000"

# Dead Letter Topics, uno por consumidor: lo que no se pudo procesar tras los reintentos. 14 días.
topico orders.events.reportes.DLT delete 14
topico orders.events.auditoria.DLT delete 14
topico audit.timeline.auditoria.DLT delete 14

echo
kafka-topics --bootstrap-server "$BOOTSTRAP" --list
echo "Topicos listos."
