---
id: 040
type: fix
status: draft
---

# Fix 040 — Las colas quedan caídas (down) al detener el nodo principal de RabbitMQ

## Qué estaba mal

Spec 033 (AC de alta disponibilidad): si cae un nodo, el otro debe seguir atendiendo las colas sin perder mensajes.

En la presentación, y antes en un ensayo, al detener `rabbit1` con `docker compose stop rabbit1` las 6 colas `q.cmd.*`
quedaron en estado **`down`** en la consola de `rabbit2`, en vez de pasar a `rabbit2`. Volvieron recién al levantar
`rabbit1` otra vez.

Causa:

- Las colas son espejadas clásicas (`ha-mode: all`). Un `docker compose stop` es un apagado **ordenado**, y para ese caso
  RabbitMQ usa por defecto `ha-promote-on-shutdown: when-synced`: solo promueve el espejo si está **sincronizado**. Si no
  lo está, deja la cola caída para no entregar una copia incompleta.
- Las políticas de `EP2/despliegue/mq/politicas/` (y las que restaura `ms-cleanfresh-mq-admin` en `TopologiaBase`) no
  fijan ese parámetro, así que rige el valor por defecto.
- El espejo de `rabbit2` no estaba sincronizado (o no estaba activo) porque los nodos se habían reiniciado varias veces
  seguidas en los ensayos (`stop`/`start` de `rabbit2`, `rabbitmq-queues rebalance`). En el log de `rabbit2` del
  2026-10-29 los procesos de los espejos se crean recién cuando `rabbit1` vuelve (07:33), no antes de detenerlo (07:31).
- Nada avisaba de que un espejo estaba sin sincronizar: el problema se ve recién al detener el nodo.

## Comportamiento correcto esperado

- Al detener o perder el nodo principal de una cola, el espejo del otro nodo toma el relevo **siempre** y la cola sigue
  `running`. Las 4 políticas (`ha-all`, `policy.email.dlx`, `policy.kitchen.dlx`, `policy.invoice.dlx`) llevan, además de
  `ha-mode: all` y `ha-sync-mode: automatic`:
  - `ha-promote-on-shutdown: always`
  - `ha-promote-on-failure: always`
- `TopologiaBase` de `ms-cleanfresh-mq-admin` (restaurar la topología base) aplica exactamente las mismas políticas, para
  que restaurar no deshaga el arreglo.
- `ms-cleanfresh-mq-admin` agrega a `/api/mq/metricas` una alerta cuando una cola `q.cmd.*` no tiene su espejo
  sincronizado (`synchronised_slave_nodes` vacío), igual que hoy avisa de las DLQ con mensajes. Así el riesgo se ve
  **antes** de detener un nodo.
- `mq-init` comprueba, además de que existan los 6 espejos, que estén sincronizados.
- `verificar-mq.sh` comprueba que las políticas llevan `ha-promote-on-shutdown: always`.

Riesgo aceptado (documentarlo en la spec y en la guía de la demo): con `always`, si el espejo no estaba sincronizado se
pueden perder los mensajes que no alcanzaron a copiarse. Se prefiere la **disponibilidad** (que el sistema siga
funcionando) en vez de dejar las colas caídas. Las *quorum queues* evitarían ese costo, pero exigen 3 nodos (fuera de
alcance).

## Fuera de alcance

- Migrar a *quorum queues* o agregar un tercer nodo.
- Repartir los nodos en máquinas distintas.

## Acceptance Criteria

1. Las 4 políticas de `politicas/` y las de `TopologiaBase` llevan `ha-promote-on-shutdown: always` y
   `ha-promote-on-failure: always`; en la consola, **Admin → Policies** las muestra en el clúster de AWS.
2. Con un mensaje en `q.cmd.email`, `docker compose stop` del nodo principal deja las 6 colas en `running` en el otro
   nodo, con el mensaje dentro (Node cambia de nodo, sin `+1`).
3. Lo mismo después de reiniciar dos veces seguidas el nodo espejo (el caso que falló): las colas no quedan `down`.
4. Al volver el nodo detenido, cada cola recupera su espejo sincronizado
   (`rabbitmqctl list_queues name slave_pids synchronised_slave_pids` muestra el otro nodo en las dos columnas).
5. `/api/mq/metricas` trae una alerta mientras una cola tiene el espejo sin sincronizar, y deja de traerla al
   sincronizarse.
6. `verificar-mq.sh`, `verificar-admin.sh`, `verificar-flujo.sh` y `demo-nodo-caido.sh` en "Todo OK"; pruebas de
   `ms-cleanfresh-mq-admin` en verde.
