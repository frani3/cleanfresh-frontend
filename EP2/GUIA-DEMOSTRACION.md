# Guía de demostración y operación — EP2

Comandos para operar las EC2 y pasos para demostrar, en vivo, todo lo
implementado en las Specs 029 a 033. Los valores de los recursos están en la sección
"Despliegue en AWS" de [`CLAUDE.md`](../CLAUDE.md). No incluye contraseñas ni
tokens.

## 0. Datos rápidos

| Recurso | Valor |
|---|---|
| EC2 #1 `cleanfresh-bff` | **IP fija (Elastic IP) `3.213.118.143`** (BFF en Docker, `:8080`); IP privada `172.31.33.129` |
| EC2 #2 `cleanfresh-ms` | IP privada `172.31.39.91`; IP pública **cambia con cada Stop/Start** (última conocida: `52.90.146.243`; la actual se ve en la consola de EC2) |
| API Gateway | `https://0ksy5y3586.execute-api.us-east-1.amazonaws.com` |
| Frontend | `http://localhost:3000` (se abre siempre con ese origen) |
| EC2 #3 `cleanfresh-mq` | IP privada `172.31.18.141`; IP pública cambia con cada Stop/Start (la actual se ve en la consola de EC2). Clúster RabbitMQ en `~/mq`; panel en `:15672` y `:15673` |
| RDS | `cleanfresh-db`, bases `orders_db`, `catalog_db` y `notificaciones_db` |

Carpeta de trabajo en la EC2 #2: `~/cleanfresh/cleanfresh-frontend/EP2/despliegue`.

## 1. Antes de la demostración (checklist)

1. En la consola de AWS: las tres EC2 (`cleanfresh-bff`, `cleanfresh-ms`, `cleanfresh-mq`) en *Running* con *2/2 checks passed*, la RDS
   en *Available*.
2. Si el laboratorio se apagó y se volvió a encender, anotar la **nueva IP pública de la EC2 #2 y de la EC2 `cleanfresh-mq`** (la privada y la del BFF no cambian: el BFF tiene Elastic IP). Si en algún momento la IP del BFF cambiara, hay que actualizar las **dos** integraciones de la API Gateway (`ANY` y `OPTIONS`) a `http://<IP-DEL-BFF>:8080/{proxy}`.
3. Levantar el frontend en la PC: `npm start` en `cleanfresh-frontend` y abrir
   `http://localhost:3000`.
4. Verificar el sistema completo en la EC2 #2 (ver 3).

## 2. Conectarse a las EC2

En PowerShell, con la llave `.pem` de la key pair:

```powershell
ssh -i "C:\Users\franc\Downloads\key.pem" ec2-user@<IP-PUBLICA-EC2-2>   # microservicios
ssh -i "C:\Users\franc\Downloads\key.pem" ec2-user@3.213.118.143        # BFF (IP fija)
ssh -i "C:\Users\franc\Downloads\key.pem" ec2-user@<IP-PUBLICA-EC2-MQ>      # RabbitMQ
```

El puerto 22 solo acepta tu IP pública. Si hay timeout, tu IP cambió: editar la
regla SSH del grupo de seguridad (`cleanfresh-sg-ms` / `cleanfresh-sg-bff` / `cleanfresh-sg-mq`; en esta última también las reglas del panel, 15672–15673) y
elegir "My IP".

## 3. Verificación automática (EC2 #2)

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP2/despliegue
./verificar.sh              # comprobación rápida (crea 1 orden de prueba)
./verificar.sh --reiniciar  # además reinicia orders y comprueba persistencia
```

Termina en `Todo OK`. Comprueba contenedores, respuesta de cada servicio,
consulta directa a las tres bases, aislamiento entre bases, el clúster RabbitMQ visto por el
administrador (dos nodos activos y 11 bindings) y los comandos por RabbitMQ: crea una orden y
comprueba el aviso a la sucursal y el ticket de taller, la despacha y comprueba el aviso al cliente y
la boleta, sin duplicados.
Si dice `Permission denied`, usar `bash verificar.sh`.

## 4. Operar los contenedores

**EC2 #2 (microservicios)**, dentro de `EP2/despliegue`:

```bash
docker compose ps                          # estado de los 6 servicios
docker compose logs -f notificaciones      # log en vivo (Ctrl+C para salir)
docker compose logs --since 10m orders     # últimos 10 minutos de un servicio
docker compose logs --since 10m orders 2>&1 | grep -E "ERROR|WARN"
docker compose restart orders              # reiniciar uno
docker compose stop notificaciones         # detener uno (ver demo del desacople)
docker compose start notificaciones
docker compose up -d --build               # reconstruir y levantar todo (tras git pull)
free -m                                    # memoria y swap
```

Servicios: `orders` (8081), `catalog` (8082), `notificaciones` (8083),
`reportes` (8084), `auditoria` (8085), `mq-admin` (8086).

**EC2 #1 (BFF)**:

```bash
docker ps --format '{{.Names}} {{.Status}}'
docker logs --since 10m bff 2>&1 | tail -30
curl -s localhost:8080/actuator/health        # {"status":"UP"...} (público)
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/api/orders   # 401 sin token
```

El BFF no registra cada petición; un log vacío es normal. Sus variables están en `~/bff.env`
(`COGNITO_ISSUER_URI`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN` y las URL de los microservicios, entre ellas
`ORDERS_SERVICE_URL=http://172.31.39.91:8081` ... `MQ_ADMIN_SERVICE_URL=http://172.31.39.91:8086`; el archivo no se sube a git). Para actualizarlo:

```bash
cd ~/ms-cleanfresh-bff && git pull && docker build -q -t cleanfresh/bff .
docker rm -f bff
docker run -d --name bff --restart unless-stopped -p 8080:8080 --env-file ~/bff.env cleanfresh/bff
```

## 5. Demostrar cada cosa implementada

### 5.1 Los 6 microservicios en Docker (ACs 13–15)

```bash
docker compose ps                 # EC2 #2: 6 servicios Up, puertos 8081–8086
docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' $(docker compose ps -q)   # unless-stopped
```

En la EC2 #1: `docker ps` muestra el contenedor `bff`.

### 5.2 Bases de datos en la RDS (ACs 1–4)

Consulta directa a las tablas, con el usuario de cada servicio (EC2 #2):

```bash
cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue
set -a; . ./.env; set +a
H=$(echo "$ORDERS_DB_URL" | sed -E 's#jdbc:postgresql://([^:/]+).*#\1#')

docker run --rm -e PGPASSWORD="$ORDERS_DB_PASSWORD" postgres:16 psql -h $H -U $ORDERS_DB_USER -d orders_db \
  -c "select numero_orden, cliente, servicio, estado, sucursal from ordenes order by id desc limit 5"

docker run --rm -e PGPASSWORD="$CATALOG_DB_PASSWORD" postgres:16 psql -h $H -U $CATALOG_DB_USER -d catalog_db \
  -c "select id, nombre, precio from servicios"
```

```bash
docker run --rm -e PGPASSWORD="$NOTIFICACIONES_DB_PASSWORD" postgres:16 psql -h $H -U $NOTIFICACIONES_DB_USER -d notificaciones_db \
  -c "select id, tipo, destinatario_tipo, destinatario, numero_orden, leida from notificaciones order by id desc limit 5"
```

Aislamiento (cada usuario solo entra a su base). Debe fallar con
`permission denied for database`:

```bash
docker run --rm -e PGPASSWORD="$ORDERS_DB_PASSWORD" postgres:16 psql -h $H -U $ORDERS_DB_USER -d catalog_db -c "select 1"
```

Persistencia: crear una orden desde la app, `docker compose restart orders`,
esperar 35 s y comprobar que sigue en `GET /api/orders` (o repetir la consulta).

En la consola de AWS, **RDS → cleanfresh-db**: *Publicly accessible: No*. La
base no responde desde internet, pero la app funciona.

### 5.3 RabbitMQ: clúster, mensajería y administrador (Spec 033)

La mensajería corre en la EC2 `cleanfresh-mq` (IP privada `172.31.18.141`): dos nodos
RabbitMQ (`rabbit1`, `rabbit2`) en un solo clúster, con las 3 colas de comandos
(`q.cmd.email`, `q.cmd.kitchen`, `q.cmd.invoice`), cada una con su cola de mensajes muertos
(`.dlq`), y los exchanges `cmd.direct`, `cmd.topic` y `cmd.dead.dlx`. Detalle en
[`despliegue/mq/README.md`](despliegue/mq/README.md) y en la
[Spec 033](specs/033-spec-rabbitmq.md).

**Panel de RabbitMQ** (solo desde tu IP): `http://<IP-PUBLICA-EC2-MQ>:15672` (nodo 1) y `:15673`
(nodo 2); usuario y clave en el `.env` de `~/mq`. La IP pública de esta EC2 también cambia con
cada Stop/Start. En el panel:

| Pestaña | Qué mostrar |
|---|---|
| **Overview → Nodes** | Los dos nodos (`rabbit@rabbit1`, `rabbit@rabbit2`) activos |
| **Exchanges** | `cmd.direct` (direct), `cmd.topic` (topic), `cmd.dead.dlx` (direct) |
| **Queues** | Las 6 colas; en `Node` y `+1` se ve que cada una tiene su espejo en el otro nodo |
| **Queues → una cola → Bindings** | Qué claves la alimentan (`email.send`, `email.*`, `email.send.*`...) |

**Clúster y topología** (desde el PC o la propia EC2, con el `.env` de `mq/`):

```bash
cd EP2/despliegue/mq
MQ_API=http://<IP-PUBLICA-EC2-MQ>:15672 ./verificar-mq.sh   # nodos, topología, enrutamiento, espejos y DLQ; termina en "Todo OK"
```

**Caída de un nodo** (en la EC2 `cleanfresh-mq`, `~/mq`):

```bash
sudo ./demo-nodo-caido.sh
```

Publica un mensaje, detiene `rabbit1`, comprueba que el mensaje se lee desde `rabbit2` y que se puede
seguir publicando, vuelve a levantar `rabbit1` y por último reinicia los dos nodos: los mensajes
persistentes sobreviven.

**Flujo completo con los servicios reales** (en la EC2 #2):

```bash
cd ~/cleanfresh/cleanfresh-frontend/EP2/despliegue
MQ_DIR=$PWD MQ_API=http://172.31.18.141:15672 ESPERA_DLQ=100 bash mq/verificar-flujo.sh
```

Comprueba: orden normal por `cmd.direct` (ticket de taller y aviso al Operador), despacho (aviso al
Cliente y boleta), orden de *Servicio exprés* por `cmd.topic` (claves `kitchen.ticket.thermal`,
`email.send.high`, `invoice.gen.pdf`), **idempotencia** (el mismo mensaje dos veces produce un solo
ticket), **mensaje venenoso** (3 intentos, va a la DLQ, queda registrado en `/api/muertos`) y que las
6 colas terminan vacías.

**Mensaje a la DLQ, a mano** (para mostrarlo en el panel):

1. Panel → **Exchanges → `cmd.direct` → Publish message**: *Routing key* `email.send`,
   *Payload* `esto no es json` → *Publish*.
2. **Queues → `q.cmd.email.dlq`**: a los pocos segundos aparece 1 mensaje (el consumidor lo intentó 3
   veces y lo rechazó). Con *Get messages* se ve el cuerpo y, en las cabeceras, `x-death` con la cola de
   origen y el motivo.
3. Como máximo en 30 s `notificaciones` lo registra y lo confirma: la DLQ vuelve a 0 y
   `curl -s localhost:8083/api/muertos` (EC2 #2) lo lista. En el log aparece
   `Mensaje NO ENTREGADO en q.cmd.email.dlq ...` (`docker compose logs notificaciones`).

**Idempotencia, a mano:** publicar dos veces el mismo mensaje válido (mismo `eventId`) en
`cmd.direct` con clave `kitchen.ticket` y comprobar que `curl -s localhost:8083/api/tickets` muestra un solo
ticket para esa orden. El cuerpo está en `verificar-flujo.sh` (sección 4).

**Administrador de RabbitMQ** (`ms-cleanfresh-mq-admin`, `:8086` en la EC2 #2). No es público: se llega
por el BFF y solo con rol Admin. Desde la consola del navegador, con sesión de **Admin** iniciada:

```js
const k = Object.keys(sessionStorage).find(k => k.startsWith('oidc.user:'));
const t = JSON.parse(sessionStorage[k]).access_token;
const base = 'https://0ksy5y3586.execute-api.us-east-1.amazonaws.com/api/mq/';
const llamar = async (m, r, cuerpo) => { const x = await fetch(base + r, {method: m, headers: {Authorization: 'Bearer ' + t, 'Content-Type': 'application/json'}, body: cuerpo && JSON.stringify(cuerpo)}); console.log(m, r, x.status, (await x.text()).slice(0, 200)); };
await llamar('GET', 'topologia');                       // nodos, exchanges, colas y bindings
await llamar('GET', 'metricas');                        // mensajes por cola y alerta de DLQ
await llamar('POST', 'exchanges/cmd.demo', {tipo: 'topic'});   // crear un exchange
await llamar('POST', 'queues/q.demo.pagos');            // crear una cola con su DLQ
await llamar('POST', 'bindings', {exchange: 'cmd.demo', cola: 'q.demo.pagos', clave: 'pagos.#'});
// mirar el panel de RabbitMQ: aparecen cmd.demo, q.demo.pagos y q.demo.pagos.dlq
await llamar('DELETE', 'queues/q.demo.pagos?conDlq=true');     // eliminar la cola y su DLQ
await llamar('DELETE', 'exchanges/cmd.demo');
```

Esperado: `200` en todas con rol **Admin**; con **Operador** o **Cliente**, `403`; sin token, `401`. El
administrador también tiene Swagger: `ssh -L 8086:localhost:8086 ec2-user@<IP-PUBLICA-EC2-2>` y abrir
`http://localhost:8086/swagger-ui.html`. `POST /api/mq/topologia/base` vuelve a declarar la topología del
enunciado (idempotente).

**Alerta de DLQ:** cuando una DLQ tiene mensajes, `GET /api/mq/metricas` responde `hayAlerta: true` y el
administrador deja una línea `ALERTA DLQ ...` en su log (`docker compose logs mq-admin`), también por su
revisión periódica (cada 30 s). Las cifras del panel se refrescan cada pocos segundos.

### 5.4 Autenticación y roles (ACs 17–18)

En `http://localhost:3000`, iniciar sesión con cada usuario de Cognito y cerrar
sesión entre uno y otro:

| Rol | Debe verse |
|---|---|
| **Cliente** | "Mis órdenes", catálogo con botón solicitar |
| **Operador** | KPIs operacionales, gestión de órdenes, catálogo. Sin Reportería ni Auditoría |
| **Admin** | Panel de administración con órdenes, catálogo, analítica por sucursal y auditoría |

Autorización por rol en el BFF, desde **F12 → Console** de la página ya con la
sesión iniciada (Chrome pide escribir `allow pasting` antes de pegar):

```js
const k = Object.keys(sessionStorage).find(k => k.startsWith('oidc.user:'));
const t = JSON.parse(sessionStorage[k]).access_token;
for (const p of ['reportes','auditoria'])
  fetch('https://0ksy5y3586.execute-api.us-east-1.amazonaws.com/api/'+p, {headers:{Authorization:'Bearer '+t}})
    .then(async r => console.log(p, r.status, (await r.text()).slice(0,80)));
```

Esperado: **Admin** `200` en las dos; **Operador** y **Cliente** `403`.

Sin token (desde cualquier terminal):

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" https://0ksy5y3586.execute-api.us-east-1.amazonaws.com/api/orders   # 401 (authorizer)
curl.exe -s -o NUL -w "%{http_code}`n" http://3.213.118.143:8080/api/orders                                  # 401 (BFF directo)
```

### 5.5 Aislamiento de red (AC 16)

Desde la PC (fuera de AWS), estas conexiones **no deben responder**:

```powershell
Test-NetConnection <IP-PUBLICA-EC2-2> -Port 8081      # TcpTestSucceeded : False (también 8082–8086)
Test-NetConnection cleanfresh-db.cjeictyledp6.us-east-1.rds.amazonaws.com -Port 5432   # False
```

Lo mismo para RabbitMQ: `Test-NetConnection <IP-PUBLICA-EC2-MQ> -Port 5672` debe dar `False` (AMQP solo acepta a los
microservicios); el panel (15672) solo responde desde tu IP.

En cambio `Test-NetConnection 3.213.118.143 -Port 8080` sí responde: es la única
entrada pública, detrás de API Gateway.

### 5.7 Avisos al Operador y al Cliente (Spec 030)

La cola ya no solo se ve en un log: cada mensaje se convierte en un aviso
guardado y dirigido, que se ve en la campanita de la app.

1. **Cliente:** inicia sesión y solicita un servicio (por ejemplo en Providencia).
2. **Operador:** inicia sesión, deja "Sucursal en turno" en esa sucursal y abre la
   campanita: aparece **"Pedido nuevo: ORD-00XX ..."**, resaltado y con contador.
   Al abrirla queda como leído.
3. **Operador:** abre la orden con **Ver → Ajustar estado → Despachado → Confirmar
   cambio**. El cambio ahora se guarda en el backend, no solo en pantalla.
4. **Cliente:** en unos segundos (la app consulta cada 15 s) su campanita muestra
   **"Pedido listo: Tu pedido ORD-00XX (...) está listo"**.
5. **Admin:** su campanita muestra todos los avisos en modo solo lectura (sin
   contador: no marca nada como leído, para no borrarles los pendientes a los demás).

Cada rol ve solo lo suyo: otro Cliente no ve el aviso de este pedido, y un
Operador de otra sucursal no ve el del pedido nuevo.

En la EC2 #2, los mismos avisos por la API de `notificaciones` y por la base:

```bash
curl -s "localhost:8083/api/notificaciones?sucursal=Providencia"      # avisos de la sucursal
curl -s "localhost:8083/api/notificaciones?cliente=<username-del-cliente>"   # avisos de un cliente
docker compose logs -f notificaciones                                  # "Notificación: ..." en vivo
```

Desacople, ahora con avisos: `docker compose stop notificaciones`, despachar una
orden desde la app (el cambio de estado funciona igual), y al hacer
`docker compose start notificaciones` el aviso aparece solo, porque esperó en la
cola.

### 5.6 Reinicios (ACs 14–15)

Con la consola: **Instance state → Reboot instance** en cada EC2. Tras ~2 minutos
`docker ps` debe mostrar los contenedores `Up` sin intervención. No usar
Stop/Start si no hace falta: cambia la IP pública.

### 5.8 Desacople: la solicitud sobrevive a la caída de notificaciones

Es el caso que hay que mostrar: el cliente solicita un servicio, los comandos llegan a RabbitMQ,
**pero el microservicio de notificaciones está caído**. La solicitud no se pierde: queda
guardada, los comandos esperan en las colas y, cuando `notificaciones` vuelve a levantarse, los
consume y genera el aviso y el ticket de taller.

**Automático (recomendado), en la EC2 #2:**

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP2/despliegue
./demo-desacople.sh
```

El script va narrando seis pasos y verifica cada uno:

1. Estado inicial: todo `Up`, las colas vacías y un consumidor en cada una (lee las colas por la API de RabbitMQ).
2. Detiene `notificaciones` (la "caída") y comprueba que su puerto ya no responde y que las colas quedaron sin consumidores.
3. Crea la solicitud del cliente (`POST /api/orders`): responde **201** y la orden queda
   guardada en la RDS aunque notificaciones esté caído.
4. Muestra que las colas pasaron de 0 a **mensajes esperando** y que todavía no existe el aviso.
5. Levanta `notificaciones` de nuevo.
6. Comprueba que consumió lo que esperaba: apareció el aviso para el Operador de Providencia, el ticket de
   taller, las colas volvieron a 0 y hay un solo aviso (sin duplicados).

Termina con `Desacople demostrado: la solicitud sobrevivió a la caída y llegó cuando el servicio volvió.`
Deja `notificaciones` levantado y una orden de prueba "Demo-Desacople-…". Si dice `Permission denied`,
usar `bash demo-desacople.sh`.

**Manual, mostrando el panel de RabbitMQ** (para enseñar el mensaje dentro de la cola):

1. En la EC2 #2: `docker compose stop notificaciones`.
2. En la app, como **Cliente**, solicitar un servicio. Funciona igual: la orden aparece en "Tus pedidos".
3. Panel de RabbitMQ → **Queues**: `q.cmd.email` y `q.cmd.kitchen` con *Ready = 1* y *Consumers = 0*.
   Con **Get messages** (*Ack mode: Nack message requeue true*, para no consumirlo) se ve el JSON del
   comando con su `eventId`, `traceId` y el `payload`.
4. En la app, como **Operador**: la campanita todavía **no** muestra ese pedido.
5. `docker compose start notificaciones`. A los pocos segundos: en los logs
   (`docker compose logs -f notificaciones`) aparece el aviso y el ticket, las colas vuelven a 0 y la
   campanita del Operador (consulta cada 15 s) muestra "Pedido nuevo".

Nota: las cifras del panel se refrescan cada pocos segundos.

## 6. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `redirect_mismatch` al iniciar sesión | El App Client de Cognito debe tener la callback URL exacta `http://localhost:3000/` (con la barra final) |
| El frontend no llama al BFF correcto | `REACT_APP_BFF_URL` en el `.env` del frontend; reiniciar `npm start` tras cambiarlo |
| `orders`/`catalog` reinician en bucle | La base no existe o falla la conexión: `docker compose logs orders`. Ver `ARQUITECTURA.md` (GRANT en RDS) |
| SSH sin respuesta tras reiniciar la EC2 #2 | Memoria agotada; ya está en `t3.medium` con swap persistente. Si pasa: Stop → Start |
| `notificaciones` no registra avisos | Revisar `RABBIT_ENABLED=true`, `RABBITMQ_ADDRESSES` (IP privada de `cleanfresh-mq`) y las credenciales en el `.env`; el grupo `cleanfresh-sg-mq` debe aceptar 5672–5673 desde `cleanfresh-sg-ms`. `docker compose logs notificaciones` muestra si se conectó (`Created new connection`) |
| La campanita no muestra avisos | Revisar que `notificaciones` esté `Up` y con `RABBIT_ENABLED=true`, y que el BFF tenga `NOTIFICACIONES_SERVICE_URL` (si falta, apunta a `localhost:8083`). Probar `curl localhost:8083/api/notificaciones` en la EC2 #2 |
| Cambiar el estado de una orden da error en la app | Un Operador solo puede cambiar órdenes de la sucursal que tiene en turno (403 si es de otra). `orders` responde 400 si el estado no es válido |
| 401 con token válido | El token expiró: cerrar sesión y volver a entrar |
| Se cambió la IP pública de la EC2 #2 o de `cleanfresh-mq` | Solo afecta al SSH y al panel; el BFF y los servicios usan las IP privadas (`172.31.39.91` y `172.31.18.141`) |
| `/api/mq/...` responde 503 | El BFF no alcanza al administrador: `cleanfresh-sg-ms` debe aceptar el puerto 8086 desde `cleanfresh-sg-bff`, y `mq-admin` debe estar `Up` |
| Un nodo de RabbitMQ no arranca o `mq-init` no crea los espejos | `cd ~/mq && sudo docker compose logs mq-init`; con volúmenes nuevos `sudo docker compose down -v && sudo docker compose up -d` (borra los mensajes) |
| El clúster no se ve completo en el panel tras reiniciar la EC2 `mq` | Esperar ~2 minutos: los contenedores arrancan solos y el segundo nodo tarda más. `sudo docker ps` en `~/mq` |

## 7. Al terminar la evaluación

Las 3 EC2 (BFF, microservicios y RabbitMQ), la RDS y la API Gateway son recursos reales y **cobran mientras
existan**. Eliminarlos o detenerlos en la consola (EC2 → Terminate/Stop,
RDS → Delete o Stop temporarily, API Gateway → Delete) y liberar la Elastic IP del BFF
(`3.213.118.143`), que cobra si queda sin asociar. El User Pool de Cognito tiene costo despreciable en
este uso, pero también se puede borrar.
