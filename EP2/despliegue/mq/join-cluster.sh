#!/bin/bash
# Arranque del segundo nodo (rabbit2): la primera vez se une al clúster de rabbit1; en los
# arranques siguientes ya es miembro (queda guardado en su volumen) y arranca normal.
set -e

DATOS=/var/lib/rabbitmq/mnesia
MARCA="$DATOS/.cleanfresh-cluster-unido"

if [ -f "$MARCA" ]; then
  echo "[join-cluster] rabbit2 ya es parte del clúster: arranque normal"
  exec docker-entrypoint.sh rabbitmq-server
fi

echo "[join-cluster] primer arranque: se une a rabbit@rabbit1"
docker-entrypoint.sh rabbitmq-server -detached
# El nodo tarda unos segundos en registrarse: se espera con reintentos antes de usar rabbitmqctl.
for _ in $(seq 1 60); do
  rabbitmq-diagnostics -q ping >/dev/null 2>&1 && break
  sleep 2
done
rabbitmqctl await_startup
rabbitmqctl stop_app
rabbitmqctl reset
rabbitmqctl join_cluster rabbit@rabbit1
rabbitmqctl start_app
touch "$MARCA"
rabbitmqctl stop
echo "[join-cluster] unido; arrancando en primer plano"
exec docker-entrypoint.sh rabbitmq-server
