---
id: 033
type: spec
status: implemented
---

# Spec 033 — Mensajería de comandos con un clúster RabbitMQ de dos nodos

## Qué debe hacer

La pauta de la evaluación pide RabbitMQ para los comandos asíncronos (notificaciones, tickets,
boletas). El profesor permitió usar SQS, pero la pauta puntúa cosas que SQS no puede dar (dos
nodos, clúster, docker-compose, exchanges `direct` y `topic`), y se acordó con él cambiar a
**RabbitMQ**. Esta spec reemplaza SQS por RabbitMQ y cubre todos los puntos de la pauta
relacionados con él:

- Un **clúster de dos nodos** levantado con `docker-compose` en una EC2 propia, con el panel de
  administración.
- La topología del enunciado: **6 colas** (3 flujos, cada uno con su cola y su DLQ), **3 exchanges**
  (`cmd.direct`, `cmd.topic`, `cmd.dead.dlx`) y sus **bindings**.
- `orders` **produce** los comandos y `notificaciones` los **consume**, con ACK/NACK explícitos,
  idempotencia y un envelope común.
- Las DLQ no se quedan mudas: los microservicios **registran** los mensajes que no se entregaron.
- Un **microservicio administrador** que crea colas, exchanges y bindings, y elimina colas y
  exchanges.
- Métricas y alerta de la tasa de DLQ por cola.

Alcance de la pauta acordado con el profesor: **sin Kafka** y sin los microservicios ligados a él
(`report` y `audit` quedan como están); el IDaaS es AWS Cognito en lugar de Azure.

## Topología

Tres flujos adaptados a la lavandería (el caso original habla de cocina; acá es el taller):

| Cola principal | Propósito | DLQ asociada | Consume |
|---|---|---|---|
| `q.cmd.email` | Avisos al Operador y al Cliente (correo/push) | `q.cmd.email.dlq` | `notificaciones` |
| `q.cmd.kitchen` | Ticket de taller: hoja de trabajo que se imprime en la sucursal | `q.cmd.kitchen.dlq` | `notificaciones` |
| `q.cmd.invoice` | Generación de la boleta del pedido | `q.cmd.invoice.dlq` | `notificaciones` |

El caso dice que `notify` notifica "a clientes (email/webpush) y a la cocina (tickets)", así que
los tres consumidores viven en `ms-cleanfresh-notificaciones`, cada uno con su propio listener.

**Exchanges:** `cmd.direct` (direct, enrutamiento exacto), `cmd.topic` (topic, patrones `*` = una
palabra y `#` = cero o más) y `cmd.dead.dlx` (direct, exchange de las DLQ).

**Bindings**, tal como los pide el enunciado:

| Exchange | Cola | Clave / patrón |
|---|---|---|
| `cmd.direct` | `q.cmd.email` | `email.send` |
| `cmd.direct` | `q.cmd.kitchen` | `kitchen.ticket` |
| `cmd.direct` | `q.cmd.invoice` | `invoice.gen` |
| `cmd.topic` | `q.cmd.email` | `email.*` (`email.send`) |
| `cmd.topic` | `q.cmd.email` | `email.send.*` (`email.send.high`) — agregado |
| `cmd.topic` | `q.cmd.kitchen` | `kitchen.#` (`kitchen.ticket`, `kitchen.ticket.thermal`) |
| `cmd.topic` | `q.cmd.invoice` | `invoice.*` (`invoice.gen`) |
| `cmd.topic` | `q.cmd.invoice` | `invoice.gen.*` (`invoice.gen.pdf`) — agregado |
| `cmd.dead.dlx` | `q.cmd.email.dlq` | `email.send` |
| `cmd.dead.dlx` | `q.cmd.kitchen.dlq` | `kitchen.ticket` |
| `cmd.dead.dlx` | `q.cmd.invoice.dlq` | `invoice.gen` |

**Nota sobre los patrones:** en RabbitMQ `*` casa exactamente una palabra, así que `email.*` casa
`email.send` pero **no** `email.send.high`, que es el ejemplo que da el enunciado (lo mismo con
`invoice.*` e `invoice.gen.pdf`). Para que las variantes de los ejemplos lleguen se agregan los
bindings `email.send.*` e `invoice.gen.*`, además de los de la tabla. `kitchen.#` sí casa
`kitchen.ticket.thermal` porque `#` casa cero o más palabras.

Cada cola principal declara `x-dead-letter-exchange = cmd.dead.dlx` y su `x-dead-letter-routing-key`
(`email.send`, `kitchen.ticket`, `invoice.gen`): un mensaje rechazado sin reencolar va a la DLQ
que le corresponde, enrutado por el exchange de DLQ.

## Qué publica `orders`

| Momento | Comandos (clave de enrutamiento) |
|---|---|
| Al crear una orden | `kitchen.ticket` (ticket de taller de la sucursal) y `email.send` (aviso al Operador de esa sucursal) |
| Al pasar a *Despachado* | `email.send` (aviso al Cliente) e `invoice.gen` (boleta) |

Las órdenes de **Servicio exprés** publican por `cmd.topic` con la variante (`email.send.high`,
`kitchen.ticket.thermal`, `invoice.gen.pdf`); las demás, por `cmd.direct` con la clave base. Así
se usan los dos tipos de exchange en el flujo normal del sistema.

## Envelope común

```json
{
  "type": "ORDEN_CREADA",
  "eventId": "b9c1…-uuid",
  "timestamp": "2026-10-15T14:03:22Z",
  "traceId": "4f7a…-uuid",
  "correlationId": "ORD-0007",
  "payload": { "numeroOrden": "ORD-0007", "cliente": "…", "clienteNombre": "…", "servicio": "…",
               "sucursal": "…", "total": 15000.0, "fecha": "2026-10-15" }
}
```

`eventId` es único por mensaje y es la clave de idempotencia; `traceId` agrupa lo que se dispara
desde una misma petición y `correlationId` es el número de orden. Los mensajes se publican
persistentes y con confirmación del broker (*publisher confirms*).

## Despliegue

Siguiendo la estructura que sugiere la pauta, la mensajería va en su **propia EC2** (`ec2-mq`) con
su propio compose; los microservicios siguen en la EC2 #2.

- **Clúster:** dos contenedores RabbitMQ (`rabbit1`, `rabbit2`) con la misma cookie de Erlang;
  `rabbit2` se une a `rabbit1` al arrancar. Las colas se replican en los dos nodos con una política
  de alta disponibilidad, así que el sistema sigue funcionando si cae uno.
- **Panel de administración** en el puerto 15672 de cada nodo, accesible solo desde la IP del
  autor.
- **Topología cargada al arrancar** desde un archivo de definiciones del repositorio, para que
  sea reproducible.
- **Grupo de seguridad** `cleanfresh-sg-mq`: AMQP (5672 y 5673) solo desde el grupo de los
  microservicios; panel (15672 y 15673) y SSH solo desde la IP del autor.
- Los clientes se conectan a los dos nodos (lista de direcciones) para seguir funcionando si cae uno.
- `restart: unless-stopped` y volúmenes: las colas y los mensajes persistentes sobreviven a un
  reinicio.

## Microservicio administrador

`ms-cleanfresh-mq-admin` (Spring Boot, puerto 8086, sin base de datos, con Swagger/OpenAPI). No es
público: se llega a él por el BFF, solo con rol Admin.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/mq/topologia` | Lista exchanges, colas y bindings del clúster |
| POST / DELETE | `/api/mq/queues/{nombre}` | Crea (con o sin DLQ asociada) / elimina una cola |
| POST / DELETE | `/api/mq/exchanges/{nombre}` | Crea (direct o topic) / elimina un exchange |
| POST / DELETE | `/api/mq/bindings` | Crea / elimina un binding (exchange, cola, clave) |
| POST | `/api/mq/topologia/base` | Vuelve a declarar la topología del enunciado (idempotente) |
| GET | `/api/mq/metricas` | Mensajes por cola y en cada DLQ, con alerta si una DLQ no está vacía |

## Fuera de alcance

- Kafka, Zookeeper, `ms-report` y `ms-audit` (el profesor pidió no incluirlos por ahora).
- Un clúster de tres nodos (la pauta pide dos).
- Que el frontend tenga una pantalla para administrar RabbitMQ: se usa el panel propio de RabbitMQ
  y los endpoints del administrador.
- Correo, impresión y PDF reales: los consumidores registran el aviso, el ticket y la boleta.
- Reprocesar la DLQ automáticamente: se reenvía a mano o con el administrador.

## Acceptance Criteria

**Clúster**

1. Un `docker-compose.yml` del repositorio levanta dos nodos RabbitMQ (`rabbit1` y `rabbit2`) con
   el panel de administración, en una EC2 propia.
2. El panel muestra **dos nodos activos** y están unidos en **un solo clúster** (`rabbitmqctl
   cluster_status` lista ambos).
3. Las colas se replican en los dos nodos; si se detiene un nodo, los servicios siguen publicando
   y consumiendo por el otro.
4. Tras reiniciar los contenedores o la EC2, el clúster vuelve a formarse solo y conserva las
   colas y los mensajes persistentes.

**Topología**

5. Existen las 6 colas, los 3 exchanges (`cmd.direct` direct, `cmd.topic` topic y `cmd.dead.dlx`
   direct) y los bindings de la tabla (más los dos agregados), cargados al arrancar desde el archivo
   de definiciones.
6. Un mensaje a `cmd.direct` llega solo a la cola de su clave (`email.send` → email,
   `kitchen.ticket` → kitchen, `invoice.gen` → invoice); una clave sin binding no llega a ninguna.
7. En `cmd.topic`, `email.send.high`, `kitchen.ticket.thermal` e `invoice.gen.pdf` llegan a sus
   colas, y `email.send.high` no llega a las otras dos.

**Productor y consumidores**

8. Todo mensaje lleva el envelope completo (`type`, `eventId` único, `timestamp`, `traceId`,
   `correlationId`, `payload`) y se publica persistente con confirmación del broker.
9. `orders` publica los comandos de la tabla (creación: ticket y aviso al Operador; despacho: aviso
   al Cliente y boleta; exprés por `cmd.topic`). Si falla la publicación, la orden o el cambio de
   estado se guardan igual y el error se registra, como hoy.
10. `notificaciones` consume las tres colas con un listener independiente cada una: el email sigue
    generando los avisos de la campanita, el ticket y la boleta se registran.
11. ACK/NACK explícitos: el mensaje se confirma solo después de procesarse; si falla, se rechaza.
12. Un mensaje inválido ("venenoso") se reintenta 3 veces y va a la DLQ de su cola por
    `cmd.dead.dlx`, sin bloquear a los demás; se demuestra la redirección.
13. Idempotencia: el mismo `eventId` recibido dos veces produce **un solo** aviso, ticket o boleta.
14. Cada DLQ tiene un consumidor que **registra** el mensaje no entregado (cuerpo original, cola de
    origen, motivo y número de intentos) en el log y en la base.

**Administrador, métricas y cierre**

15. `ms-cleanfresh-mq-admin` crea y elimina colas y exchanges y crea bindings; lo hecho se ve en
    el panel de RabbitMQ y en `GET /api/mq/topologia`.
16. `GET /api/mq/metricas` muestra los mensajes por cola y por DLQ y avisa cuando una DLQ no está
    vacía; el administrador lo registra como advertencia en su log.
17. Solo el rol Admin llega al administrador a través del BFF (401 sin token, 403 con otro rol);
    expone Swagger/OpenAPI.
18. Con RabbitMQ apagado (desarrollo local sin broker) los servicios arrancan y siguen funcionando.
19. SQS deja de usarse: se retiran su código, sus variables y la cola `cleanfresh-ordenes`; los
    avisos con los tres roles (campanita) y el desacople siguen funcionando, ahora sobre RabbitMQ.
20. Evidencia en `EP2/EVIDENCIA-EP2.md` y guía de demostración con: dos nodos, caída de un nodo,
    mensaje a la DLQ, idempotencia, desacople y uso del administrador.

## Verificación

Fases: 1 clúster y topología, 2 productor y consumidores, 3 administrador, 4 métricas, 5 AWS y retiro de
SQS, 6 cierre. Las fases 1 a 4 se prueban primero en local con Docker; la 5 en AWS.

**Fase 1 — clúster y topología (hecha, solo local con Docker Desktop).** Archivos en
[`EP2/despliegue/mq/`](../despliegue/mq/README.md). Se verifican con `verificar-mq.sh` y
`demo-nodo-caido.sh`.

| # | AC | Estado |
|---|---|---|
| 1 | `docker-compose.yml` levanta `rabbit1` y `rabbit2` con el panel de administración (puertos 15672 y 15673); `mq-init` carga la topología cuando ven los dos nodos activos | ✅ Cumple (local) |
| 2 | La API de administración y `rabbitmqctl cluster_status` listan `rabbit@rabbit1` y `rabbit@rabbit2` como nodos de disco, **activos y en un solo clúster** | ✅ Cumple (local) |
| 3 | Con `rabbit1` detenido, el mensaje persistente publicado antes se lee desde `rabbit2`, se publica uno nuevo y, al volver `rabbit1`, los dos mensajes siguen en la cola | ✅ Cumple (local) |
| 4 | Al reiniciar los dos nodos el clúster se forma solo (`rabbit2` ya no vuelve a unirse: su volumen recuerda que es miembro) y los 2 mensajes persistentes siguen en `q.cmd.email`, con su espejo sincronizado | ✅ Cumple (local); falta reiniciar la EC2 en la fase 5 |
| 5 | 3 exchanges (`cmd.direct` y `cmd.dead.dlx` direct, `cmd.topic` topic), las 6 colas durables, las 3 principales con `x-dead-letter-exchange = cmd.dead.dlx` y su clave de DLQ, y los 11 bindings declarados | ✅ Cumple (local) |
| 6 | `cmd.direct`: `email.send` → solo email, `kitchen.ticket` → solo kitchen, `invoice.gen` → solo invoice; una clave sin binding no llega a ninguna (`routed: false`) | ✅ Cumple (local) |
| 7 | `cmd.topic`: `email.send`, `email.send.high`, `kitchen.ticket`, `kitchen.ticket.thermal`, `invoice.gen` e `invoice.gen.pdf` llegan **solo** a su cola | ✅ Cumple (local) |

Además, de los criterios de las fases siguientes ya se comprobó que un mensaje rechazado sin reencolar
en cada una de las 3 colas llega a su DLQ por `cmd.dead.dlx` (motivo `rejected` en `x-death`) y deja la
cola principal vacía; el AC 12 (reintentos y consumidor real) sigue pendiente.

Dos problemas reales que se encontraron y corrigieron:

- **Los espejos no se creaban.** La política de alta disponibilidad cargada junto con las definiciones
  quedaba registrada (`ha-all` aparecía en las 6 colas) pero **no replicaba nada**: `slave_pids` salía
  vacío y, al detener `rabbit1`, el mensaje persistente no se podía leer desde `rabbit2`. Aplicar la
  política con las colas ya creadas sí crea y sincroniza los espejos, así que ahora `mq-init` la aplica
  como último paso y `verificar-mq.sh` comprueba que cada cola tenga un espejo sincronizado.
- **El segundo nodo se reiniciaba en bucle.** `join-cluster.sh` llamaba a `rabbitmqctl` antes de que el
  nodo se registrara; ahora espera con reintentos.

Limitaciones conocidas: las colas espejo son una función obsoleta en RabbitMQ 3.13 (se retira en 4.0),
por eso la imagen está fijada en `3.13`; con dos nodos no sirven las colas "quorum", que necesitan
mayoría. Los dos nodos corren como contenedores de una misma EC2, no en máquinas distintas.

**Fase 2 — productor y consumidores (hecha, solo local).** `orders` (publica) y `notificaciones`
(consume) contra el clúster real de la fase 1. Se verifica con 28 + 38 pruebas automáticas (broker
simulado) y con [`verificar-flujo.sh`](../despliegue/mq/verificar-flujo.sh), que usa los dos servicios
reales (ejecutado dos veces seguidas: "Todo OK").

| # | AC | Estado |
|---|---|---|
| 8 | Sobre completo y mensaje persistente con confirmación del broker | ✅ Cumple (pruebas de `RabbitOrderEventPublisher`; confirmación real en el flujo local) |
| 9 | Orden normal → `kitchen.ticket` + `email.send` por `cmd.direct`; despacho → aviso al Cliente + `invoice.gen`; exprés → `.thermal` / `.high` / `.pdf` por `cmd.topic` | ✅ Cumple (local): ticket, aviso, boleta y las claves exprés llegaron como se esperaba |
| 10 | Tres listeners independientes: aviso en la campanita, ticket y boleta registrados | ✅ Cumple (local): `/api/notificaciones`, `/api/tickets`, `/api/boletas` |
| 11 | ACK manual tras procesar; `basicNack` sin reencolar si falla | ✅ Cumple (pruebas de `GestorMensajes` y flujo local: las 6 colas terminan vacías) |
| 12 | Mensaje venenoso: 3 intentos y a su DLQ por `cmd.dead.dlx`, sin bloquear la cola | ✅ Cumple (local) en `q.cmd.email` y `q.cmd.kitchen` (con un `ORDEN_LISTA` en la cola de tickets); `q.cmd.invoice` solo por pruebas automáticas |
| 13 | El mismo `eventId` dos veces → un solo efecto | ✅ Cumple (local): publicado dos veces por la API de RabbitMQ, un solo ticket |
| 14 | Cada DLQ tiene un consumidor que registra el mensaje (cola de origen, motivo, intentos, cuerpo) en el log y la base | ✅ Cumple (local) para las DLQ de email y kitchen: aparece en `/api/muertos` y la DLQ queda vacía |

Además se probó el **desacople**: con `notificaciones` detenido, `orders` creó la orden igual, los
comandos esperaron en `q.cmd.email` y `q.cmd.kitchen` (0 consumidores, 1 mensaje cada una) y, al volver
el servicio, los consumió (un aviso y un ticket de esa orden).

Precisiones: el campo `intentos` del registro de mensajes muertos es el conteo de `x-death` de RabbitMQ
(veces que el mensaje fue enviado a la DLQ, normalmente 1); los 3 intentos de proceso quedan en el log del
consumidor. El revisor de DLQ corre cada 30 s (20 s en la prueba), así que un mensaje puede estar en la DLQ
unos segundos antes de registrarse. La prueba automática falló dos veces por errores del propio script
(orden de campos del JSON, retraso de las estadísticas del panel, un ticket de una corrida anterior) y se
corrigió el script, no el servicio.

**Fase 3 — administrador (hecha, solo local).** Repo nuevo
[`ms-cleanfresh-mq-admin`](https://github.com/frani3/ms-cleanfresh-mq-admin) (puerto 8086, sin base de
datos, Swagger) y la ruta `/api/mq/**` del BFF. Se verifica con 40 pruebas del administrador, 10 nuevas del
BFF (54 en total) y [`verificar-admin.sh`](../despliegue/mq/verificar-admin.sh), que contrasta cada
cambio con la API del panel de RabbitMQ (corrido contra el clúster real, "Todo OK").

| # | AC | Estado |
|---|---|---|
| 15 | Crea/elimina colas y exchanges y crea/elimina bindings; se ve en el panel de RabbitMQ y en `GET /api/mq/topologia` | ✅ Cumple (local): cola con su DLQ y su DLX, exchange topic, binding con `#`, y todo se confirmó en el panel; nombres inválidos, exchanges `amq.*` y tipos distintos de direct/topic se rechazan con 400 |
| 16 | `GET /api/mq/metricas` muestra mensajes por cola y DLQ y avisa cuando una DLQ no está vacía, con una advertencia en el log | 🟡 La parte del endpoint y la advertencia en el log: ✅ (local, con un mensaje real en `q.cmd.invoice.dlq`). Falta la revisión periódica (fase 4) |
| 17 | Solo el rol Admin llega al administrador por el BFF (401 sin token, 403 con otro rol); Swagger/OpenAPI | 🟡 Swagger ✅ (`/swagger-ui.html`, `/v3/api-docs`). 401/403/200 probados con `jwt()` simulado; falta probarlo con un token real de Cognito (fase 5, desplegado) |

Otros comportamientos verificados en vivo:

- `POST /api/mq/topologia/base` es **idempotente** (dos veces seguidas, siguen 11 bindings) y **repara**:
  eliminado a mano el binding `email.*`, `email.otro` dejó de enrutarse y volvió a hacerlo al declarar la base.
- Con `rabbit1` detenido, el administrador siguió respondiendo, creó y eliminó colas por el segundo nodo
  (prueba el cliente con dos URL de la API de administración).
- `DELETE /bindings` (con cuerpo) funciona por el cliente HTTP real del BFF, y las claves con `*` y `#`
  se eliminan bien (la API pide la clave codificada; el administrador la busca antes de borrar).
- Un `404` o `400` del administrador llega al Admin con su mismo código; si el administrador no responde,
  el BFF contesta `503`.

Limitaciones: la política `ha-all` solo cubre colas `q.cmd.*`; las cifras de métricas tienen unos segundos
de retraso (estadísticas del panel); el BFF solo reenvía las rutas conocidas del administrador (lista
blanca), el resto responde 404.

**Fase 4 — alerta de DLQ (hecha, solo local).** El administrador revisa las DLQ solo (`AlertaDlq`, cada
30 s; configurable) y no depende de que alguien pida las métricas. 45 pruebas del administrador en total.

| # | AC | Estado |
|---|---|---|
| 16 | `GET /api/mq/metricas` y advertencia en el log cuando una DLQ no está vacía | ✅ Cumple (local): con un mensaje dejado en `q.cmd.email.dlq` el log mostró `WARN ... ALERTA DLQ (revisión periódica): La DLQ q.cmd.email.dlq tiene 1 mensaje(s) sin atender` una sola vez (la revisión corrió varias veces) y, tras vaciarla, `Las DLQ volvieron a estar vacías` |

Avisa cuando la situación **cambia**, no en cada vuelta, para que el log no se llene con la misma línea. Si
no hay broker, anota que no pudo revisar y reintenta en el siguiente intervalo (no se cae). Las cifras
dependen de las estadísticas del panel de RabbitMQ, así que el aviso puede tardar unos segundos de más.

**Fase 5 — AWS y retiro de SQS (hecha).** Clúster en la EC2 `cleanfresh-mq`, microservicios y administrador en
la EC2 #2, BFF reconstruido. La evidencia con las salidas está en
[`EVIDENCIA-EP2.md`](../EVIDENCIA-EP2.md) (sección 10).

| # | AC | Estado |
|---|---|---|
| 1 | `docker-compose.yml` levanta `rabbit1` y `rabbit2` con panel, en una EC2 propia | ✅ Cumple (AWS): EC2 `cleanfresh-mq` (`t3.medium`), grupo `cleanfresh-sg-mq` |
| 2 | El panel muestra dos nodos activos en un solo clúster | ✅ Cumple (AWS): `verificar-mq.sh` y el administrador (`rabbit@rabbit1 (activo)`, `rabbit@rabbit2 (activo)`) |
| 3 | Colas replicadas en los dos nodos; con un nodo detenido se sigue publicando y consumiendo | ✅ Cumple (AWS): `demo-nodo-caido.sh` en la EC2, espejos sincronizados en las 6 colas |
| 4 | Tras reiniciar contenedores o la EC2, el clúster se forma solo y conserva colas y mensajes | ✅ Cumple (AWS): reinicio de los dos nodos dentro de `demo-nodo-caido.sh` y `reboot` de la EC2 (los contenedores volvieron solos y el clúster se reformó) |
| 5–7 | Topología y enrutamiento (`cmd.direct`, `cmd.topic`) | ✅ Cumple (AWS): `verificar-mq.sh` ("Todo OK" tres veces) y `verificar-flujo.sh` con claves reales |
| 8–11 | Envelope, comandos de `orders`, tres listeners de `notificaciones`, ACK/NACK | ✅ Cumple (AWS): `verificar.sh` y `verificar-flujo.sh` en la EC2 #2 |
| 12 | Mensaje venenoso: 3 intentos y DLQ, sin bloquear la cola | ✅ Cumple (AWS) en `q.cmd.email` y `q.cmd.kitchen`; `q.cmd.invoice` solo en pruebas automáticas y local |
| 13 | Idempotencia por `eventId` | ✅ Cumple (AWS): un solo ticket aunque llegue dos veces |
| 14 | Las DLQ tienen un consumidor que registra el mensaje | ✅ Cumple (AWS) para email y kitchen: `/api/muertos` y DLQ vacía |
| 15 | El administrador crea/elimina colas, exchanges y bindings | ✅ Cumple en local (cada cambio contrastado con el panel). 🟡 En AWS se comprobó que el administrador ve el clúster (topología y métricas por el BFF) y que `verificar.sh` lo valida; no se repitió ahí el crear/eliminar |
| 16 | Métricas y alerta de DLQ | ✅ Cumple (local); en AWS, `/api/mq/metricas` responde 200 por el BFF |
| 17 | Solo Admin llega al administrador por el BFF; Swagger | ✅ Cumple (AWS, token real de Cognito): sin token 401, Admin 200, Operador 403. 🟡 El 403 con rol Cliente no se probó |
| 18 | Con RabbitMQ apagado los servicios arrancan y funcionan | ✅ Cumple (pruebas automáticas y local, `RABBIT_ENABLED=false` por defecto) |
| 19 | SQS deja de usarse: se retiran código, variables y la cola `cleanfresh-ordenes` | ✅ Cumple (AWS): cola eliminada (`list-queues` → `None`), código y variables retirados; avisos y desacople siguen funcionando sobre RabbitMQ |

Dos problemas reales de la fase (detallados en la evidencia): los espejos no se creaban en el primer arranque
porque `mq-init` aplicaba la política mientras `rabbit2` se reiniciaba (ahora espera nodos estables y comprueba
los espejos), y la EC2 de mensajería se lanzó como `t3.micro` y hubo que pasarla a `t3.medium`.

**Fase 6 — cierre (hecha).**

| # | AC | Estado |
|---|---|---|
| 20 | Evidencia en `EP2/EVIDENCIA-EP2.md` y guía de demostración con: dos nodos, caída de un nodo, mensaje a la DLQ, idempotencia, desacople y uso del administrador | ✅ Cumple: [`EVIDENCIA-EP2.md`](../EVIDENCIA-EP2.md) sección 10 y [`GUIA-DEMOSTRACION.md`](../GUIA-DEMOSTRACION.md) 5.3 y 5.8. `ARQUITECTURA.md` y `CLAUDE.md` (sincronizado en los 8 repos) actualizados |

**Pendiente para completar la verificación:** el 403 con rol Cliente en `/api/mq/**`; repetir en AWS el
crear/eliminar del administrador; la DLQ de `q.cmd.invoice` con consumidores reales en AWS; capturas de pantalla.
**Al terminar la evaluación:** liberar la Elastic IP del BFF y apagar o eliminar las 3 EC2, la RDS y la API Gateway.
