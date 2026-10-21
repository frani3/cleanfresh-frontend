# Evidencia EP2

Comandos ejecutados y resultados obtenidos al verificar la Spec 029 sobre el
despliegue en AWS (`us-east-1`). Complementa la tabla de verificación de
[`specs/029-spec-arquitectura-ep2.md`](specs/029-spec-arquitectura-ep2.md). Los
valores de los recursos están en la sección "Despliegue en AWS" de `CLAUDE.md`.
Contraseñas y tokens no se incluyen.

> **Spec 033 (RabbitMQ):** la mensajería con SQS de las secciones 2, 6, 7 y 8 quedó como historial: la
> Spec 033 la reemplazó por RabbitMQ. La evidencia vigente de mensajería, del administrador y de la
> retirada de SQS está en la **sección 10**.
>
> **Capturas de pantalla:** por adjuntar en `EP2/capturas/` (panel del Admin,
> del Operador y del Cliente con `ORD-0008`, y las pantallas de la consola de
> AWS).

## 1. Persistencia en RDS (ACs 1–4, 13)

En la EC2 #2, con las bases creadas en la RDS y los servicios levantados con
`docker compose up -d --build`:

```bash
curl -s localhost:8081/api/orders | head -c 150   # [{"id":1,"numeroOrden":"ORD-0001",...
curl -s localhost:8082/api/catalog | head -c 150  # [{"id":1,"nombre":"Lavado y secado",...
```

Se creó una orden y se reinició `orders`; las 7 órdenes siguieron ahí:

```bash
curl -s -X POST localhost:8081/api/orders -H 'Content-Type: application/json' \
  -d '{"cliente":"Prueba RDS","servicio":"Planchado","total":9500,"sucursal":"Providencia"}'
# {"id":7,"numeroOrden":"ORD-0007",...,"estado":"CREADO",...}
docker compose restart orders; sleep 35
curl -s localhost:8081/api/orders | grep -o '"numeroOrden"' | wc -l   # 7
```

Incidente: la primera vez `orders` y `catalog` entraron en bucle de reinicios con
`FATAL: database "orders_db" does not exist`. En RDS, `CREATE DATABASE ... OWNER x`
requiere ser miembro de `x`; se resolvió con `GRANT orders_user TO postgres` (y
lo mismo para `catalog_user`) y creando las bases. Ambos servicios arrancaron
solos gracias a `restart: unless-stopped`.

## 2. Mensajería SQS (ACs 9–11) — historial, reemplazada por RabbitMQ (sección 10)

Con `SQS_ENABLED=true` y el `LabInstanceProfile` de la EC2 #2, tras el `POST` de
`ORD-0007`:

```bash
docker compose logs notificaciones 2>&1 | grep "ORD-"
# Notificación: la orden ORD-0007 de Prueba RDS (Planchado, sucursal Providencia, total 9500.0) fue creada
```

## 3. Red y seguridad (ACs 16–17)

Desde la máquina de desarrollo (fuera de AWS):

| Prueba | Resultado |
|---|---|
| Puertos 8081–8085 de la EC2 #2 | sin respuesta |
| Puerto 5432 de la RDS (IP privada `172.31.77.18`) | sin respuesta |
| `GET /actuator/health` al BFF (`:8080`) | 200, `status: UP` |
| `GET /api/orders` al BFF sin token | 401 |
| `GET /api/orders` a API Gateway sin token | 401 (authorizer) |
| `GET /api/orders` a API Gateway con token falso | 401 |
| Preflight `OPTIONS /api/orders` con `Origin: http://localhost:3000` | 200, con `access-control-allow-origin: http://localhost:3000` (lo resuelve el BFF) |

Autorización por rol, desde la consola del navegador con el access token real de
cada sesión (`GET https://<api-gateway>/api/reportes` y `/api/auditoria`):

| Rol | `/api/reportes` | `/api/auditoria` |
|---|---|---|
| Admin | 200 | 200 |
| Operador | 403 | 403 |

## 4. Flujo completo con los tres roles (AC 18)

En `http://localhost:3000`, con usuarios de Cognito:

- **Cliente:** solicitó "Lavado y secado". Se creó `ORD-0008`; `orders` la guardó
  en la RDS y publicó `ORDEN_CREADA`; `notificaciones` registró:
  `Notificación: la orden ORD-0008 de 64888468-1021-70ae-1c1b-36e6f67b3175 (Lavado y secado, sucursal Providencia, total 25000.0) fue creada`.
  El `cliente` es el `username` del access token (UUID).
- **Admin:** panel de administración con las 8 órdenes (incluida `ORD-0008`) y
  las pestañas de analítica y auditoría.
- **Operador:** panel operativo con KPIs, gestión de órdenes y catálogo; ve las
  órdenes de la sucursal en turno (Providencia: `ORD-0001`, `ORD-0007`, `ORD-0008`).

Incidente: el primer intento de login falló con `redirect_mismatch`. La app envía
`redirect_uri=http://localhost:3000/` y el App Client solo tenía registrado
`http://localhost:3000/redirect.html`. Se agregó la URL exacta con la barra final
y el login funcionó.

## 5. Reinicios (ACs 14–15)

| Prueba | Resultado |
|---|---|
| Reinicio de la EC2 #1 | `bff Up 17 seconds`, `/actuator/health` 200 |
| Reinicio de la EC2 #2 | los 5 contenedores volvieron solos, pero la máquina quedó sin responder (ni SSH ni Instance Connect) |
| Stop → cambio a `t3.medium` → Start de la EC2 #2 | 5 contenedores `Up`, `curl localhost:8081/api/orders` → 8 órdenes, `free -m` 3835 MB |

La causa del cuelgue fue memoria: cinco JVM con el heap por defecto en una
`t3.small` (2 GB) con el swap perdido tras el reinicio. Se subió a `t3.medium` y
se dejó el swap en `/etc/fstab` (`Swap: 2047`).

## 6. Verificación final automatizada (`verificar.sh --reiniciar`)

Ejecutada en la EC2 #2 sobre el despliegue en AWS, con el `LabInstanceProfile`
para SQS y las credenciales de cada servicio para la RDS. Crea una orden de
prueba (`ORD-0009`), por eso las órdenes pasan de 8 a 9.

```
1) Contenedores
  OK   orders Up 14 minutes
  OK   catalog Up 14 minutes
  OK   notificaciones Up 14 minutes
  OK   reportes Up 14 minutes
  OK   auditoria Up 14 minutes
2) Servicios responden
  OK   orders: 8 órdenes
  OK   catalog: 5 servicios
  OK   reportes: respuesta fija
  OK   auditoria: respuesta fija
  OK   notificaciones: proceso activo (HTTP 404; no tiene endpoints propios)
3) Bases de datos en la RDS (consulta directa con el usuario de cada servicio)
  OK   orders_db: 8 órdenes, última ORD-0008
  OK   catalog_db: 5 servicios, 20 filas de disponibilidad por sucursal
4) Aislamiento: cada usuario solo entra a su base
  OK   orders_user NO puede entrar a catalog_db
  OK   catalog_user NO puede entrar a orders_db
5) Cola SQS: orders publica y notificaciones consume
  OK   orden creada: ORD-0009 (Verificacion-040315)
  OK   notificaciones recibió ORD-0009 desde SQS: Notificación: la orden ORD-0009 de Verificacion-040315 (Planchado, sucursal Providencia, total 9500.0) fue creada
  OK   orders sin errores de publicación
6) Persistencia tras reiniciar orders
  OK   antes: 9, después: 9 órdenes

Todo OK
```

Esto demuestra en vivo: los 5 servicios en Docker, los datos en PostgreSQL
(RDS) con una base y un usuario por servicio, el aislamiento entre bases, el
recorrido completo por SQS y la persistencia tras un reinicio.

## 7. Avisos dirigidos por SQS (Spec 030) — historial, ahora por RabbitMQ (sección 10)

Verificación en el entorno real de AWS. El detalle por criterio está en
[`specs/030-spec-notificaciones-dirigidas.md`](specs/030-spec-notificaciones-dirigidas.md).

### 7.1 Despliegue

- En la RDS: `CREATE USER notificaciones_user`, `GRANT notificaciones_user TO postgres`,
  `CREATE DATABASE notificaciones_db OWNER notificaciones_user` y `REVOKE CONNECT ... FROM PUBLIC`
  (respuestas `CREATE ROLE`, `GRANT ROLE`, `CREATE DATABASE`, `REVOKE`).
- EC2 #2: `git pull` de los repos y `docker compose up -d --build`; `notificaciones` responde
  `200` en `/api/notificaciones` y `orders` responde `404` al cambiar el estado de una orden
  inexistente (prueba de que corre el endpoint nuevo).
- EC2 #1: imagen del BFF reconstruida y contenedor recreado con `NOTIFICACIONES_SERVICE_URL`;
  `bff Up`, `/actuator/health` en `UP`, y `401` sin token en `PUT /api/orders/{n}/estado` y en
  `GET /api/notificaciones`.

### 7.2 Verificación automática (`verificar.sh --reiniciar`, EC2 #2)

```
3) Bases de datos en la RDS (consulta directa con el usuario de cada servicio)
  OK   orders_db: 9 órdenes, última ORD-0009
  OK   catalog_db: 5 servicios, 20 filas de disponibilidad por sucursal
  OK   notificaciones_db: 0 avisos (0 sin leer)
4) Aislamiento: cada usuario solo entra a su base
  OK   orders_user NO puede entrar a catalog_db
  OK   catalog_user NO puede entrar a orders_db
  OK   orders_user NO puede entrar a notificaciones_db
  OK   notificaciones_user NO puede entrar a orders_db
5) Avisos por SQS: pedido nuevo -> Operador; pedido listo -> Cliente
  OK   orden creada: ORD-0010 (cliente Verificacion-181626, sucursal Providencia)
  OK   aviso al Operador de Providencia: Nuevo pedido ORD-0010: Planchado de Verificacion-181626 en Providencia (total $9.500)
  OK   el Cliente aún no tiene avisos (la orden no está lista)
  OK   orden ORD-0010 pasada a DESPACHADO (HTTP 200)
  OK   un estado inválido se rechaza (HTTP 400)
  OK   aviso al Cliente: Tu pedido ORD-0010 (Planchado) está listo
  OK   despachar dos veces no duplica el aviso (1 aviso)
  OK   marcar leídos solo afecta a ese Cliente (1 aviso)
  OK   orders sin errores de publicación
6) Persistencia tras reiniciar orders y notificaciones
  OK   órdenes antes: 10, después: 10
  OK   avisos antes: 2, después: 2

Todo OK
```

(El script completo también comprueba los 5 contenedores y las respuestas de cada servicio;
aquí se muestran las secciones propias de la Spec 030.)

### 7.3 Cambio de estado con token real

Desde la consola del navegador, con la sesión del Operador (`PUT` por API Gateway):

```
fetch('https://<api-gateway>/api/orders/ORD-0011/estado?sucursal=Providencia', { method: 'PUT', ... {estado:'DESPACHADO'} })
HTTP 200 {"id":11,"numeroOrden":"ORD-0011","cliente":"64888468-...","servicio":"Lavado en seco",
          "estado":"DESPACHADO","fecha":"2026-10-07","total":45000.0,"sucursal":"Providencia"}
```

### 7.4 Flujo con los tres roles en la app

Estado leído directamente en los servicios (EC2 #2) después de usar la app:

```
== ordenes de la cliente 64888468
  ORD-0008 CREADO Providencia
  ORD-0011 DESPACHADO Providencia          <- despachada con la llamada manual de 7.3
  ORD-0012 DESPACHADO Providencia          <- despachada con el botón del panel del Operador
== avisos de esa cliente
  7 ORDEN_LISTA ORD-0012 leida= False | Tu pedido ORD-0012 (Lavado en seco) está listo
  6 ORDEN_LISTA ORD-0011 leida= True  | Tu pedido ORD-0011 (Lavado en seco) está listo
== avisos de Providencia
  5 ORDEN_CREADA ORD-0012 leida= True | Nuevo pedido ORD-0012: Lavado en seco de 64888468-... en Providencia (total $45.000)
  3 ORDEN_CREADA ORD-0011 leida= True | Nuevo pedido ORD-0011: Lavado en seco de 64888468-... en Providencia (total $45.000)
  1 ORDEN_CREADA ORD-0010 leida= True | Nuevo pedido ORD-0010: Planchado de Verificacion-181626 en Providencia (total $9.500)
```

Lo que demuestra: la cliente creó `ORD-0011` y `ORD-0012` y a la sucursal le llegó cada aviso
de pedido nuevo (leídos: el Operador abrió su campanita); al despacharlas, a la cliente le
llegó el aviso de pedido listo (el de `ORD-0011` figura leído porque ella abrió la campanita;
el de `ORD-0012` seguía sin leer). En ambos servicios los logs no tenían errores.

Capturas de las campanitas de los tres roles (Admin en solo lectura sin contador, Cliente y
Operador con sus avisos): por adjuntar en `EP2/capturas/`.

### 7.5 Incidentes del despliegue

- Al apagar y encender el laboratorio cambiaron las IPs públicas. La API Gateway seguía
  apuntando a la IP vieja del BFF; se reservó una Elastic IP para el BFF y se actualizaron
  las dos integraciones (`ANY` y `OPTIONS`). El preflight `OPTIONS` por API Gateway respondió
  `200` con `access-control-allow-origin: http://localhost:3000` (lo genera el BFF, así que
  prueba que la API Gateway lo alcanza).
- `ORD-0011` parecía "no avisar" porque seguía en `CREADO`: el cambio a *Despachado* aún no se
  había hecho. Sin defecto de código.

## 8. Desacople: la solicitud sobrevive a la caída de notificaciones (con SQS; historial, ver sección 10 para RabbitMQ)

Caso que pidió el profesor: el cliente solicita un servicio, el mensaje llega a SQS y el
microservicio de notificaciones está caído; al levantarse, la solicitud debe seguir ahí y
llegar. Se ejecutó `./demo-desacople.sh` en la EC2 #2 (entorno real de AWS):

```
[1] Estado inicial: todo en marcha y la cola vacía
       notificaciones Up 41 seconds
       orders Up About an hour
       Cola SQS cleanfresh-ordenes -> mensajes disponibles: 0, en proceso: 0

[2] Se cae el microservicio de notificaciones
  OK   notificaciones detenido (sin contenedor en ejecución)
  OK   su puerto 8083 ya no responde

[3] El cliente solicita un servicio (POST /api/orders) con notificaciones caído
  OK   la solicitud se aceptó: ORD-0014 creada (HTTP 201), aunque notificaciones está caído
  OK   ORD-0014 está guardada en la base de orders (RDS)

[4] El mensaje espera en la cola de SQS (nadie lo consume todavía)
       Cola SQS cleanfresh-ordenes -> mensajes disponibles: 1, en proceso: 0
  OK   la cola pasó de 0 a 1 mensaje(s): el pedido ORD-0014 está esperando en SQS
       el aviso de ORD-0014 todavía no existe (no hay quien lo procese)

[5] Se levanta de nuevo el microservicio de notificaciones
       esperando a que arranque.....
  OK   notificaciones volvió a responder

[6] Al volver, consume el mensaje que esperaba y genera el aviso
  OK   aviso generado para el Operador de Providencia: Nuevo pedido ORD-0014: Lavado en seco de Demo-Desacople-025609 en Providencia (total $45.000)
       Cola SQS cleanfresh-ordenes -> mensajes disponibles: 0, en proceso: 0
  OK   la cola volvió a 0 mensaje(s): el pedido se consumió y se eliminó de SQS
  OK   un solo aviso para ORD-0014 (sin duplicados)

Desacople demostrado: la solicitud sobrevivió a la caída y llegó cuando el servicio volvió.
```

Lo que demuestra: con el consumidor caído, `POST /api/orders` sigue respondiendo `201` y la
orden queda en la RDS; el mensaje espera en SQS (la cola pasó de 0 a 1, leído directamente de
AWS); al levantarse `notificaciones` lo consume, genera un único aviso y la cola vuelve a 0.

Incidente de la propia prueba: en la primera ejecución una comprobación falló porque el
contador de SQS es **aproximado** y fluctúa mientras se consume (mostró 0 y, una lectura
después, 1). El sistema estaba bien; se corrigió el script para esperar a que el contador se
estabilice en vez de fiarse de una sola lectura, y la segunda ejecución pasó completa.

## 9. Nombre legible del cliente y sucursal elegible (Spec 032)

Verificación en el entorno real de AWS, después de desplegar `orders`, `notificaciones` y el BFF
(este con la variable nueva `COGNITO_DOMAIN`). El detalle por criterio está en
[`specs/032-spec-nombre-cliente-y-sucursal.md`](specs/032-spec-nombre-cliente-y-sucursal.md).

### 9.1 Limpieza de la base

Antes de probar se borraron las 8 órdenes de prueba (`ORD-0007` a `ORD-0014`) y los 9 avisos, y se
reinició el contador: quedaron las 6 órdenes de ejemplo y la siguiente orden fue `ORD-0007`.

### 9.2 Despliegue y recorrido con una orden de prueba

- Columna nueva en PostgreSQL (RDS): `cliente_nombre (character varying, nullable=YES)`, creada por
  `ddl-auto: update`; las 6 órdenes de ejemplo siguieron intactas y devolvieron `clienteNombre: null`.
- Orden de prueba creada directamente en `orders` con un nombre legible: el aviso a la sucursal salió
  como "Nuevo pedido ORD-0007: Planchado de **Prueba Nombre** en Las Condes (total $9.500)"; al
  despacharla, el aviso al cliente llegó por su identificador (buscar por el nombre legible no
  devuelve nada, porque el destinatario no cambió). La orden de prueba se borró después.

### 9.3 Orden real de un Cliente, con token real de Cognito

Un Cliente creó un pedido desde la app, eligiendo en el catálogo una sucursal distinta de la de
siempre. Estado leído directamente en la base y en `notificaciones`:

```
== ordenes
 numero_orden |               cliente                |     cliente_nombre     |  servicio |  estado |  sucursal
 ORD-0007     | 64888468-1021-70ae-1c1b-36e6f67b3175 | cliente@cleanfresh.com | Planchado | CREADO  | Las Condes

== avisos
     tipo     | destinatario_tipo | destinatario | numero_orden | leida | mensaje
 ORDEN_CREADA | SUCURSAL          | Las Condes   | ORD-0007     | f     | Nuevo pedido ORD-0007: Planchado de cliente@cleanfresh.com en Las Condes (total $15.000)
```

Lo que demuestra:

- **Nombre legible:** `cliente` conserva el identificador de Cognito (de quién es la orden) y
  `cliente_nombre` guarda el correo, que el BFF pidió a Cognito (`/oauth2/userInfo`) con el access
  token del propio usuario; el navegador no envía ni `cliente` ni `clienteNombre`. El usuario de prueba
  no tiene el atributo `name`, por eso se usó el correo.
- **Sucursal:** la orden quedó en Las Condes, elegida en el selector del catálogo. El aviso fue a esa
  sucursal, no a Providencia (un Operador lo ve con "Sucursal en turno" = Las Condes).
- **Sin fallos:** el log del BFF no registró ningún error al consultar a Cognito.

## 10. Mensajería con RabbitMQ (Spec 033)

Verificación en AWS (`us-east-1`) del reemplazo de SQS por un clúster RabbitMQ de dos nodos. Detalle de la
spec y de las pruebas locales en [`specs/033-spec-rabbitmq.md`](specs/033-spec-rabbitmq.md). Los scripts
están en [`despliegue/mq/`](despliegue/mq/) y [`despliegue/`](despliegue/). Contraseñas y tokens no se incluyen.

### 10.1 Clúster en su propia EC2 (ACs 1–7)

EC2 `cleanfresh-mq` (`t3.medium`, grupo de seguridad `cleanfresh-sg-mq`: AMQP 5672–5673 y API de
administración 15672–15673 solo desde `cleanfresh-sg-ms`; panel y SSH solo desde la IP del autor). Dos
contenedores (`rabbit1`, `rabbit2`) con `docker compose`. `verificar-mq.sh` contra esa EC2 (tres corridas
seguidas, todas `Todo OK`):

```
1) Clúster
  OK   rabbit1 y rabbit2 son miembros del mismo clúster
2) Topología cargada
  OK   exchange cmd.direct (direct) · cmd.topic (topic) · cmd.dead.dlx (direct)
  OK   6 colas durables · q.cmd.* -> DLX cmd.dead.dlx · 11 bindings · política ha-all
  OK   q.cmd.email / kitchen / invoice / (y sus .dlq) tienen espejo sincronizado en rabbit@rabbit2
3) Enrutamiento por cmd.direct: cada clave llega solo a su cola; una clave sin binding no llega a ninguna
4) Enrutamiento por cmd.topic: email.send(.high), kitchen.ticket(.thermal), invoice.gen(.pdf) -> solo su cola
5) Un mensaje rechazado va a su DLQ por cmd.dead.dlx (motivo en x-death: rejected)
Todo OK
```

`demo-nodo-caido.sh` en la EC2 (detiene `rabbit1`, lee y publica por `rabbit2`, vuelve `rabbit1`, reinicia los
dos nodos): todos los pasos `OK`, "el sistema siguió sin un nodo y no se perdió ningún mensaje". Tras un
`reboot` de la EC2 los contenedores volvieron solos (`restart: unless-stopped`, Docker habilitado) y el clúster
se reformó.

Dos problemas reales, ya corregidos:

- **Los espejos no se creaban en el primer arranque.** En la EC2, `rabbit2` se une al clúster, se detiene y se
  reinicia; `mq-init` contó "2 nodos activos" en ese instante, aplicó la política `ha-all` y no se crearon los
  espejos (`slave_nodes: []`). Ahora `mq-init` exige ver los dos nodos activos 4 veces seguidas y, tras aplicar
  la política, comprueba que existan los 6 espejos (y la reaplica si no). Se recreó el clúster desde cero y
  `mq-init` informó `espejos creados: 6 de 6 colas`.
- **La prueba de DLQ de `verificar-mq.sh` fallaba de forma intermitente** contra la EC2: el mensaje rechazado
  volvía a la cola principal con `redelivered: true`. La API HTTP del panel a veces cierra el canal antes de
  procesar el rechazo, así que no era un fallo del enrutamiento; el script ahora repite el rechazo. El
  comportamiento con consumidores reales se comprobó aparte (10.3).

### 10.2 Microservicios sobre RabbitMQ (`verificar.sh`, EC2 #2)

`orders` y `notificaciones` reconstruidos con el código de RabbitMQ (se quitó el de SQS) y el nuevo
`ms-cleanfresh-mq-admin`; `RABBITMQ_ADDRESSES` apunta a la IP privada de `cleanfresh-mq`.

```
1) Contenedores        OK  orders, catalog, notificaciones, mq-admin, reportes, auditoria (Up)
2) Servicios responden OK  ...
  OK   RabbitMQ: los dos nodos activos (visto por el administrador)
  OK   RabbitMQ: topología cargada (11 bindings)
3) Bases de datos en la RDS ... OK
4) Aislamiento: cada usuario solo entra a su base ... OK
5) Comandos por RabbitMQ: aviso al Operador/Cliente, ticket de taller y boleta
  OK   orden creada: ORD-0008 (cliente Verificacion-032844, sucursal Providencia)
  OK   aviso al Operador de Providencia: Nuevo pedido ORD-0008: Planchado de Verificacion-032844 en Providencia (total $9.500)
  OK   ticket de taller registrado para ORD-0008 (q.cmd.kitchen)
  OK   todavía no hay boleta (la orden no está despachada)
  OK   orden ORD-0008 pasada a DESPACHADO (HTTP 200)
  OK   un estado inválido se rechaza (HTTP 400)
  OK   aviso al Cliente: Tu pedido ORD-0008 (Planchado) está listo
  OK   boleta registrada: BOL-0008
  OK   despachar dos veces no duplica el aviso (1 aviso)
  OK   marcar leídos solo afecta a ese Cliente (1 aviso)
  OK   orders sin errores de publicación
Todo OK
```

### 10.3 Flujo completo con consumidores reales (`mq/verificar-flujo.sh`, EC2 #2)

```
1) Orden normal (Planchado, Providencia): cmd.direct
  OK   ticket de taller registrado (clave kitchen.ticket) · aviso al Operador · todavía no hay boleta
2) Se despacha: aviso al Cliente y boleta
  OK   aviso al Cliente · boleta BOL-0009 registrada (clave invoice.gen)
3) Orden exprés: variantes por cmd.topic
  OK   ticket llegó por kitchen.ticket.thermal · aviso (email.send.high) · boleta por invoice.gen.pdf
4) Idempotencia: el mismo mensaje dos veces produce un solo efecto
  OK   un solo ticket para ORD-91792553382 aunque llegó dos veces
5) Mensaje venenoso: 3 intentos, DLQ y registro
  OK   tras 3 intentos fallidos el mensaje pasó por q.cmd.email.dlq
  OK   q.cmd.email quedó vacía: el venenoso no bloqueó la cola
  OK   notificaciones lo registró: "colaOrigen":"q.cmd.email","motivo":"rejected","intentos":1
  OK   la DLQ quedó vacía tras registrarlo (se confirmó el mensaje)
6) El flujo del ticket y el de la boleta también tienen su DLQ
  OK   un ORDEN_LISTA en la cola de tickets va a q.cmd.kitchen.dlq y queda registrado
7) Las colas quedan vacías: las 6 colas están vacías
Todo OK
```

El campo `intentos` del registro es el conteo `x-death` de RabbitMQ (veces enviado a la DLQ, normalmente 1);
los 3 intentos de proceso quedan en el log del consumidor (`intento 1/3 falló...`, y al final
`se rechazó tras 3 intentos y va a la DLQ`). La DLQ de `q.cmd.invoice` solo se probó en vivo en local y en las
pruebas automáticas, no con este recorrido.

### 10.4 Desacople con RabbitMQ (`demo-desacople.sh`, EC2 #2)

```
[1] Estado inicial: RabbitMQ -> q.cmd.email=0 (consumidores: 1); q.cmd.kitchen=0 (consumidores: 1); q.cmd.invoice=0 (consumidores: 1)
[2] Se cae el microservicio de notificaciones
  OK   notificaciones detenido · su puerto 8083 ya no responde
  OK   las colas q.cmd.email y q.cmd.kitchen quedaron sin consumidores
[3] El cliente solicita un servicio (POST /api/orders) con notificaciones caído
  OK   la solicitud se aceptó: ORD-0011 creada (HTTP 201), aunque notificaciones está caído
  OK   ORD-0011 está guardada en la base de orders (RDS)
[4] Los comandos esperan en las colas de RabbitMQ (nadie los consume todavía)
       RabbitMQ -> q.cmd.email=0 (consumidores: 0); q.cmd.kitchen=1 (consumidores: 0); q.cmd.invoice=0 (consumidores: 0)
  OK   las colas pasaron de 0 a 1 mensaje(s)
[5] Se levanta de nuevo el microservicio de notificaciones
  OK   notificaciones volvió a responder
[6] Al volver, consume los mensajes que esperaban y genera el aviso y el ticket
  OK   aviso generado para el Operador de Providencia: Nuevo pedido ORD-0011: Lavado en seco de Demo-Desacople-033057 en Providencia (total $45.000)
  OK   ticket de taller registrado para ORD-0011
  OK   las colas volvieron a 0 mensaje(s): el pedido se consumió
  OK   un solo aviso para ORD-0011 (sin duplicados)
Desacople demostrado: la solicitud sobrevivió a la caída y llegó cuando el servicio volvió.
```

Nota: las cifras del panel se refrescan cada pocos segundos; en el paso 4 el contador de `q.cmd.email` aún
mostraba 0 cuando `q.cmd.kitchen` ya mostraba 1 (la orden genera un comando en cada una), y el paso 6 confirma
que ambos se consumieron.

### 10.5 Administrador de RabbitMQ y autorización por rol (ACs 15–17)

`ms-cleanfresh-mq-admin` (`:8086`, EC2 #2) y la ruta `/api/mq/**` del BFF (reconstruido; el contenedor anterior
quedó detenido como `bff-anterior`). Para que el BFF lo alcance se abrió el puerto 8086 en `cleanfresh-sg-ms`
desde `cleanfresh-sg-bff`. Desde la consola del navegador, con el access token real de Cognito de cada sesión
(`GET https://<api-gateway>/api/mq/topologia` y `/api/mq/metricas`):

| Prueba | `/api/mq/topologia` | `/api/mq/metricas` |
|---|---|---|
| Sin token (API Gateway y BFF directo) | 401 | 401 |
| Admin | 200 (`rabbit@rabbit1 (activo)`, `rabbit@rabbit2 (activo)`, exchanges, colas, bindings) | 200 (mensajes y consumidores por cola) |
| Operador | 403 | 403 |

El crear/eliminar colas, exchanges y bindings, la declaración idempotente de la topología base, la alerta de
DLQ y el failover entre los dos nodos se verificaron contra el clúster local con
[`despliegue/mq/verificar-admin.sh`](despliegue/mq/verificar-admin.sh) (cada cambio contrastado con la API del
panel de RabbitMQ); no se repitieron en AWS. El 403 con rol Cliente no se probó.

### 10.6 Retirada de SQS (AC 19)

La cola `cleanfresh-ordenes` estaba vacía y era la única de la cuenta. Se eliminó con la AWS CLI desde la EC2 #2
(`sqs delete-queue`); `sqs list-queues` devolvió `None` tras el borrado (el listado tardó unos segundos en
reflejarlo). Se quitaron el código y las dependencias de SQS de `orders` y `notificaciones`, y `SQS_*` / `AWS_REGION`
del `.env` y del `docker-compose.yml`.

## 11. Avisos por cada cambio de estado y actualización automática (Spec 035)

Detalle y criterios en [`specs/035-spec-avisos-por-estado-y-actualizacion-automatica.md`](specs/035-spec-avisos-por-estado-y-actualizacion-automatica.md).
Capturas en [`capturas/035/`](capturas/035/).

**Causa del problema.** Una orden real (`ORD-0013`) estaba en ENTREGADO y su Cliente no tenía ningún aviso: hasta la
Spec 034 solo se avisaba al pasar a DESPACHADO. Además "Tus pedidos" se cargaba una sola vez.

### 11.1 Migración de la restricción única (RDS)

Las pruebas con H2 fallaron al guardar el segundo aviso de estado de una orden: `Violación de índice de Unicidad ...
NOTIFICACIONES(TIPO, NUMERO_ORDEN)`. La tabla tenía una restricción única `(tipo, numero_orden)` que `ddl-auto: update` no
elimina. Se cambió a `(tipo, numero_orden, mensaje)` y `MigracionEsquema` la quita al arrancar. En la RDS:

```
Migración (Spec 035): se eliminó la restricción única uk54jum8ll46fajl6l26mxt8cjo de notificaciones (tipo, numero_orden)
restricciones únicas de notificaciones en la RDS:
ukb0n7l67yt9g5l58g1cxuvvjyh  UNIQUE (tipo, numero_orden, mensaje)
```

### 11.2 Una orden recorre los estados (EC2 #2, servicios reales)

```
orden ORD-0014: CREADO -> ACEPTADO (x2) -> EN_PREPARACION -> DESPACHADO -> ENTREGADO
   el Cliente todavía no tiene avisos: 0
    ORDEN_ESTADO | Tu pedido ORD-0014 (Planchado) fue aceptado
    ORDEN_ESTADO | Tu pedido ORD-0014 (Planchado) está en preparación
    ORDEN_LISTA  | Tu pedido ORD-0014 (Planchado) está listo
    ORDEN_ESTADO | Tu pedido ORD-0014 (Planchado) fue entregado
   avisos: 4 (el ACEPTADO repetido no duplicó) · boleta de ORD-0014: 1
orden exprés ORD-0015: CREADO -> ENTREGADO (salto) -> CANCELADO
    ORDEN_ESTADO | Tu pedido ORD-0015 (Servicio exprés) fue entregado
    ORDEN_ESTADO | Tu pedido ORD-0015 (Servicio exprés) fue cancelado
colas q.cmd.email / kitchen / invoice y sus tres .dlq: 0 mensajes
```

`verificar.sh` y `verificar-flujo.sh` en la EC2 #2 después del despliegue: "Todo OK".

### 11.3 La pantalla se actualiza sola (Chrome, API simulada con estado)

| Rol | Comprobación | Resultado |
|---|---|---|
| Cliente | Cambia el estado en el servidor, sin aviso | "Tus pedidos" pasa a "Aceptado" a los 9 s, sin recargar |
| Cliente | Llega un aviso "está en preparación" | Aparece en el módulo con la etiqueta "Estado del pedido" y las órdenes se refrescan en los 2,5 s siguientes ("En preparación") |
| Cliente | La consulta de órdenes falla | La pantalla sigue mostrando lo que había; al volver, se actualiza sola a "Entregado" |
| Operador | Llega un pedido nuevo (aviso) | ORD-0014 aparece en su lista a los 7 s, sin pulsar "Actualizar"; la búsqueda escrita y la ventana de orden abierta siguen |
| Operador | Sin avisos nuevos | 0 consultas de órdenes en 31 s |
| Admin | Llega un aviso | 0 consultas de órdenes en 33 s; ve el aviso en su pestaña con la etiqueta "Estado del pedido" |
