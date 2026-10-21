# Arquitectura objetivo — EP2

Estado: **implementada y desplegada** (specs 029 a 033). El punto de partida es la arquitectura cerrada en
EP1 (ver `EP1/specs/028-spec-despliegue-aws-ec2-api-gateway.md`).

> **Spec 033:** la mensajería pasó de AWS SQS a un **clúster RabbitMQ de dos nodos en su propia EC2**
> (`cleanfresh-mq`), con un microservicio administrador (`ms-cleanfresh-mq-admin`, :8086). El diagrama de abajo
> es el diseño original (todavía dibuja SQS); el vigente de la mensajería está en la sección
> "Mensajería con RabbitMQ", más abajo. Los valores de los recursos están en `CLAUDE.md`.

## Diagrama

```
                          ┌─────────────────────────────┐
                          │         AWS Cognito         │
                          │ User Pool us-east-1_yi2m…   │
                          │ Hosted UI + App Client      │
                          │ grupos: Admin/Operador/     │
                          │         Cliente             │
                          └──────┬───────────────▲──────┘
          (1) login              │               │ (3) JWKS / validación del JWT
      Authorization Code + PKCE  │               │
          ┌──────────────────────┘               │
          ▼                                      │
┌─────────────────────┐                          │
│ TU MÁQUINA (local)  │                          │
│                     │                          │
│ Frontend React      │                          │
│ localhost:3000      │                          │
│ react-oidc-context  │                          │
│ + interceptor axios │                          │
└─────────┬───────────┘                          │
          │ (2) Bearer access_token              │
          │     REACT_APP_BFF_URL                │
          │                                      │
┌─────────┼──────────────────────────────────────┼───────────────────────────────────────────────────────────┐
│         │       AWS  (us-east-1)               │                                                           │
│         ▼                                      │                                                           │
│ ┌──────────────────────────────────────────────┬───────────────┐                                           │
│ │ API Gateway  (cleanfresh-api / hucylsdii5)                   │                                           │
│ │ ANY /{proxy+}  + JWT Authorizer (valida issuer y audience)   │                                           │
│ │ OPTIONS /{proxy+}  (sin authorizer, CORS)                    │                                           │
│ └────────────────────────────────┬─────────────────────────────┘                                           │
│                                  │ HTTP proxy                                                              │
│                                  ▼                                                                         │
│ ┌──────────────────────────────────────────────────────────────┐                                           │
│ │ EC2 #1 – BFF                    IP: 13.222.150.67            │                                           │
│ │ [Docker] ms-cleanfresh-bff   :8080   Spring Boot / Java 21   │                                           │
│ │ · CognitoTokenValidator (token_use, client_id, scope)        │                                           │
│ │ · @PreAuthorize por rol (cognito:groups)                     │                                           │
│ │ · CORS propio                                                │                                           │
│ └────────────────────────────────┬─────────────────────────────┘                                           │
│                                  │ RestClient                                                              │
│              ┌───────────────────┼───────────────────────────────────────┬───────────────────┐             │
│              │                   │                                       │                   │             │
│ ┌────────────┼───────────────────┼───────────────────────────────────────┼───────────────────┼───────────┐ │
│ │            │                   │  EC2 #2 – Microservicios              │                   │           │ │
│ │ ┌──────────┼───────────────────┼───────────────────────────────────────┼───────────────────┼─────────┐ │ │
│ │ │          │                   │ Docker Engine (gestiona los ms)       │                   │         │ │ │
│ │ │          ▼                   ▼                                       ▼                   ▼         │ │ │
│ │ │ ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │ │ │
│ │ │ │ ms-…-orders    │  │ ms-…-catalog   │  │ ms-…-          │  │ ms-…-reportes  │  │ ms-…-auditoria │ │ │ │
│ │ │ │                ├┐ │                │  │ notificaciones │  │                │  │                │ │ │ │
│ │ │ │ :8081          ││ │ :8082          │  │ :8083          │  │ :8084          │  │ :8085          │ │ │ │
│ │ │ └────────┬───────┘│ └────────┬───────┘  └────────┴───────┘  └────────────────┘  └────────────────┘ │ │ │
│ │ │          │        │          │                   ▲                                                 │ │ │
│ │ │ ╭────────┴───────╮│ ╭────────┴───────╮           │                                                 │ │ │
│ │ │ │   BD Orders    ││ │   BD Catalog   │           │                                                 │ │ │
│ │ │ ╰────────────────╯│ ╰────────────────╯           │                                                 │ │ │
│ │ │                   │                              │                                                 │ │ │
│ │ └───────────────────┼──────────────────────────────┼─────────────────────────────────────────────────┘ │ │
│ └─────────────────────┼──────────────────────────────┼───────────────────────────────────────────────────┘ │
│                       │                              │ consume mensajes                                    │
│                       │                              │                                                     │
│                       │ publica evento               │                                                     │
│                       │               ┌──────────────┬──────────────┐                                      │
│                       │               │           AWS SQS           │                                      │
│                       └──────────────►│  Cola de eventos de órdenes │                                      │
│                                       └─────────────────────────────┘                                      │
│                                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Qué cambia respecto a EP1

| Tema | EP1 (hoy) | EP2 (objetivo) |
|---|---|---|
| Ejecución | `java -jar` directo en cada EC2 | Docker (BFF y los microservicios) |
| EC2 | 3 instancias: BFF, orders, catalog | 3 instancias: #1 BFF, #2 todos los microservicios, #3 RabbitMQ (`cleanfresh-mq`) |
| Microservicios | orders, catalog | orders, catalog + notificaciones, reportes, auditoría y el administrador de RabbitMQ (`mq-admin`) |
| Datos | en memoria (se pierden al reiniciar) | PostgreSQL en RDS: BD Orders y BD Catalog |
| Mensajería | no hay | RabbitMQ (clúster de 2 nodos en una EC2 propia): orders publica comandos, notificaciones los consume (Spec 033; SQS se usó en la Spec 029 y se retiró) |
| Seguridad de red | puertos abiertos a `0.0.0.0/0` (demo) | microservicios accesibles solo desde la EC2 #1 |

La EC2 de `catalog` (`44.203.57.139`) y la de `orders` (`3.86.143.171`)
dejan de ser necesarias: ambos servicios pasan a la EC2 #2.

## Puertos

| Servicio | Host | Puerto | Situación |
|---|---|---|---|
| ms-cleanfresh-bff | EC2 #1 | 8080 | existe hoy |
| ms-cleanfresh-orders | EC2 #2 | 8081 | existe hoy |
| ms-cleanfresh-catalog | EC2 #2 | 8082 | existe hoy |
| ms-cleanfresh-notificaciones | EC2 #2 | 8083 | nuevo |
| ms-cleanfresh-reportes | EC2 #2 | 8084 | nuevo |
| ms-cleanfresh-auditoria | EC2 #2 | 8085 | nuevo |
| ms-cleanfresh-mq-admin | EC2 #2 | 8086 | nuevo (Spec 033) |
| RabbitMQ (AMQP) | EC2 #3 | 5672 (rabbit1), 5673 (rabbit2) | nuevo (Spec 033) |
| RabbitMQ (panel y API de administración) | EC2 #3 | 15672, 15673 | nuevo (Spec 033) |

**Evaluación:** la numeración es consistente y sin conflictos. 8080–8082
coinciden con lo que ya corre hoy y 8083–8085 son una continuación
lógica. No son puertos "estándar" (no existe uno para estos servicios);
lo único que importa es que sean únicos en el host y que todo lo que
los nombre (BFF, security group, `docker run`/compose) use los mismos.

Puntos a tener en cuenta:

1. **Puerto de host vs. puerto del contenedor.** Los 5 microservicios
   comparten la EC2 #2, así que cada uno necesita un puerto de host
   distinto (correcto como está dibujado). Con Docker hay dos formas
   válidas: que cada app escuche en su propio puerto (`server.port=8083`
   y `-p 8083:8083`) o que todas escuchen en 8080 por dentro y se mapee
   distinto afuera (`-p 8083:8080`). El BFF siempre usa el **puerto de
   host**.
2. **Security group de la EC2 #2:** abrir 8081–8085 solo al security
   group/IP de la EC2 #1. API Gateway apunta únicamente al BFF (:8080);
   ningún cliente externo necesita llegar a los microservicios.
3. **Puertos que el diagrama no muestra:** PostgreSQL en RDS (5432,
   abierto solo al security group de la EC2 #2), RabbitMQ en la EC2 #3 (AMQP 5672–5673 y administración
   15672–15673 abiertos solo al security group de la EC2 #2; el panel y SSH solo a la IP del autor) y SSH (22).
   El administrador (`:8086`) solo lo alcanza el BFF.

## Decisiones tomadas

1. **Base de datos: PostgreSQL en Amazon RDS.** Una sola instancia RDS con
   dos bases lógicas (`orders_db`, `catalog_db`), cada microservicio con su
   propio usuario y conectado solo a la suya (una BD por servicio, como en el
   diagrama, pero con el costo de una sola instancia). Motivos: la pauta de
   EP1 pedía "base de datos cloud"; los datos son relacionales (órdenes con
   estado, catálogo con precios y disponibilidad por sucursal); PostgreSQL
   tiene soporte directo en Spring Data JPA y entra en la capa gratuita, a
   diferencia de Oracle. Alternativa descartada: contenedor de PostgreSQL en
   la EC2 #2 (lo único a su favor es que el diagrama dibuja las BD dentro de
   Docker; sus datos viven en el disco de la EC2 y no es una BD "cloud").
2. **Orquestación: Docker Compose, no Kubernetes.** El diagrama dice
   "Docker Engine (gestiona los ms)": los microservicios son contenedores en
   una sola EC2, declarados en un `docker-compose.yml` (imagen, puerto,
   variables, reinicio automático). Kubernetes (EKS u otro) sería otro
   diagrama y es mucho más pesado para 5 servicios en una VM.
   Confirmado: sin Kubernetes.
3. **`reportes` y `auditoría`: esqueletos estáticos en esta entrega.** Se
   crean, se despliegan y quedan detrás del BFF, pero con un controller que
   devuelve una respuesta fija: no consultan a `orders`, no tienen BD ni
   consumen la cola. Su función real (reportes de órdenes e ingresos por
   sucursal; registro de acciones y accesos denegados) se implementa en la
   siguiente entrega. Mientras tanto, las pestañas "Analítica por sucursal" y
   "Registro de auditoría" del panel Admin siguen con sus datos de ejemplo.
4. **Mensajería: RabbitMQ en lugar de SQS (Spec 033).** En la Spec 029 `orders` publicaba un evento en una
   cola SQS que consumía `notificaciones`. La pauta de la evaluación pide RabbitMQ (clúster de dos nodos,
   colas con DLQ, exchanges direct y topic, administrador), así que se reemplazó: `orders` publica
   **comandos** y `notificaciones` consume tres colas (aviso, ticket de taller, boleta). El detalle está en
   la sección siguiente y en [`specs/033-spec-rabbitmq.md`](specs/033-spec-rabbitmq.md).
5. **Los microservicios confían totalmente en el BFF.** Ninguno valida el
   JWT: el BFF es el único punto que autentica, autoriza por rol y decide qué
   datos ve cada usuario. Como esa confianza solo es segura si nadie más puede
   llamar a los microservicios, la regla de red de la sección "Puertos" pasa a
   ser obligatoria: la EC2 #2 acepta 8081–8085 únicamente desde la EC2 #1.

## Mensajería con RabbitMQ (Spec 033)

```
 orders (EC2 #2)                       EC2 #3 `cleanfresh-mq`  (clúster de 2 nodos, colas espejadas)
 publica comandos ───────────────►  ┌────────────────────────────────────────────────────────────┐
  (confirmación del broker,         │ cmd.direct (direct)  cmd.topic (topic)   cmd.dead.dlx      │
   mensajes persistentes)           │      │  email.send        │ email.* / email.send.*  (direct)│
                                    │      │  kitchen.ticket    │ kitchen.#                       │
                                    │      │  invoice.gen       │ invoice.* / invoice.gen.*       │
                                    │      ▼                    ▼                      ▲          │
                                    │  q.cmd.email    q.cmd.kitchen    q.cmd.invoice   │ rechazo  │
                                    │      └── cada una con x-dead-letter-exchange ────┘          │
                                    │  q.cmd.email.dlq  q.cmd.kitchen.dlq  q.cmd.invoice.dlq      │
                                    └───────┬─────────────────┬──────────────────┬───────────────┘
                                            │ ACK manual      │                  │
 notificaciones (EC2 #2) ◄──────────────────┴─────────────────┴──────────────────┘
  3 listeners (aviso · ticket de taller · boleta), 3 intentos, idempotencia por eventId,
  y un revisor que registra cada mensaje de las DLQ (cuerpo, cola de origen, motivo) en su base

 ms-cleanfresh-mq-admin (EC2 #2, :8086) ──► API de administración de los dos nodos (15672/15673)
  crea/elimina colas, exchanges y bindings, declara la topología base, mide las colas y avisa si una DLQ no está vacía
  ▲
  └── solo por el BFF (`/api/mq/**`), rol Admin
```

- **Comandos:** al crear una orden `orders` publica `kitchen.ticket` y `email.send`; al despacharla, `email.send` e
  `invoice.gen`. Las órdenes de *Servicio exprés* usan `cmd.topic` con las variantes `.thermal`, `.high` y `.pdf`;
  las demás, `cmd.direct`. Todos van en un sobre común (`type`, `eventId`, `timestamp`, `traceId`,
  `correlationId`, `payload`).
- **Fallos:** un mensaje que falla 3 veces se rechaza sin reencolar y RabbitMQ lo manda a la DLQ de su cola por
  `cmd.dead.dlx`; el consumidor no se bloquea y el mensaje queda registrado.
- **Alta disponibilidad:** la política `ha-all` replica las colas `q.cmd.*` en los dos nodos; con un nodo caído
  los servicios siguen publicando y consumiendo (reciben la lista de los dos nodos). Las colas espejadas son una
  función obsoleta en RabbitMQ 3.13 (se retira en 4.0), por eso la imagen está fijada en `3.13`; con dos nodos
  no sirven las colas "quorum". Los dos nodos son contenedores de una misma EC2, no máquinas distintas.
- **Desacople:** si `notificaciones` cae, los comandos esperan en las colas y se consumen al volver.

## Alcance por servicio en EP2

| Servicio | Puerto | BD | Qué hace en EP2 |
|---|---|---|---|
| ms-cleanfresh-bff | 8080 | no | igual que EP1; ahora en Docker y con rutas nuevas hacia reportes, auditoría y `/api/mq/**` (solo Admin) |
| ms-cleanfresh-orders | 8081 | `orders_db` (RDS) | migra de memoria a PostgreSQL; publica los comandos de RabbitMQ al crear una orden y al despacharla |
| ms-cleanfresh-catalog | 8082 | `catalog_db` (RDS) | migra de memoria a PostgreSQL |
| ms-cleanfresh-notificaciones | 8083 | `notificaciones_db` (RDS) | consume las 3 colas de RabbitMQ (aviso, ticket de taller, boleta), registra los mensajes de las DLQ |
| ms-cleanfresh-reportes | 8084 | no | esqueleto: controller con respuesta fija |
| ms-cleanfresh-auditoria | 8085 | no | esqueleto: controller con respuesta fija |
| ms-cleanfresh-mq-admin | 8086 | no | administra RabbitMQ (colas, exchanges, bindings, métricas); solo por el BFF y con rol Admin |

## Entorno AWS desplegado

El laboratorio de AWS se renovó y el entorno de EP1 dejó de existir, así que
todo se volvió a crear en el nuevo (fase 5 de la Spec 029). Los valores
vigentes están en la sección "Despliegue en AWS" de `CLAUDE.md`; la verificación
en [`EVIDENCIA-EP2.md`](EVIDENCIA-EP2.md).

| Capa | Recurso |
|---|---|
| IDaaS | Cognito User Pool `cleanfresh-users`, App Client `cleanfresh-spa` (SPA, sin secret), Hosted UI, scope `https://api.cleanfresh.com/access_as_user`, grupos Admin/Operador/Cliente |
| Entrada | API Gateway HTTP API con JWT Authorizer; `OPTIONS` sin authorizer; CORS en el BFF |
| EC2 #1 | BFF en Docker (`:8080`), `t3.small` |
| EC2 #2 | 6 microservicios con `docker compose` (`:8081`–`:8086`), `t3.medium`, swap persistente |
| EC2 #3 | Clúster RabbitMQ de dos nodos con `docker compose` (`:5672`–`:5673`, panel `:15672`–`:15673`), `t3.medium` |
| Datos | RDS PostgreSQL 16, bases `orders_db`, `catalog_db` y `notificaciones_db`, un usuario por servicio, sin acceso público |
| Mensajería | RabbitMQ 3.13 en la EC2 #3 (2 nodos, colas espejadas, topología cargada al arrancar) |
| Red | cuatro grupos de seguridad: internet → BFF → microservicios → RDS y RabbitMQ (solo desde los microservicios) |

Se usó el `LabInstanceProfile` que ya trae AWS Academy: no hizo falta crear
roles IAM propios.

## Lecciones del despliegue

- **RDS no es un PostgreSQL con superusuario.** `CREATE DATABASE ... OWNER x`
  falla si el usuario maestro no es miembro de `x`; hay que hacer
  `GRANT x TO postgres` antes.
- **El disco de 8 GB de la EC2 #2 se llena.** Cada `docker compose up --build` deja imágenes y caché de compilación; tras varias reconstrucciones el disco llegó al 100 % y Maven falló con `No space left on device` (el contenedor en marcha no se vio afectado). Se resuelve con `docker builder prune -f` (y `docker image prune -f`) antes de reconstruir; conviene mirar `df -h /` antes de desplegar.
- **Una `t3.micro` no basta para RabbitMQ.** La EC2 de mensajería se lanzó por error como `t3.micro` (1 GiB, insuficiente para dos nodos); se cambió a `t3.medium` (detener, cambiar el tipo, iniciar).
- **El segundo nodo de RabbitMQ se reinicia en el primer arranque** (se une al clúster y vuelve a arrancar). La política de espejos solo se crea bien si se aplica cuando los dos nodos ya están estables; `mq-init` lo espera y lo comprueba.
- **Cinco JVM en una `t3.small` no caben.** Tras un reinicio la máquina dejó de
  responder (ni SSH ni EC2 Instance Connect) y hubo que hacer Stop/Start. Se
  subió a `t3.medium`, se hizo persistente el swap y se acotó el heap por
  servicio en el `docker-compose.yml`.
- **El `redirect_uri` debe coincidir exactamente.** La app envía
  `http://localhost:3000/`; registrar solo `/redirect.html` da
  `redirect_mismatch`.
