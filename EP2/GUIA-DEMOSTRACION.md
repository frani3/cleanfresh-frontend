# Guía de demostración y operación — EP2

Comandos para operar las EC2 y pasos para demostrar, en vivo, todo lo
implementado en la Spec 029. Los valores de los recursos están en la sección
"Despliegue en AWS" de [`CLAUDE.md`](../CLAUDE.md). No incluye contraseñas ni
tokens.

## 0. Datos rápidos

| Recurso | Valor |
|---|---|
| EC2 #1 `cleanfresh-bff` | **IP fija (Elastic IP) `3.213.118.143`** (BFF en Docker, `:8080`); IP privada `172.31.33.129` |
| EC2 #2 `cleanfresh-ms` | IP privada `172.31.39.91`; IP pública **cambia con cada Stop/Start** (última conocida: `52.90.146.243`; la actual se ve en la consola de EC2) |
| API Gateway | `https://0ksy5y3586.execute-api.us-east-1.amazonaws.com` |
| Frontend | `http://localhost:3000` (se abre siempre con ese origen) |
| Cola SQS | `cleanfresh-ordenes` (`us-east-1`) |
| RDS | `cleanfresh-db`, bases `orders_db`, `catalog_db` y `notificaciones_db` |

Carpeta de trabajo en la EC2 #2: `~/cleanfresh/cleanfresh-frontend/EP2/despliegue`.

## 1. Antes de la demostración (checklist)

1. En la consola de AWS: las dos EC2 en *Running* con *2/2 checks passed*, la RDS
   en *Available*.
2. Si el laboratorio se apagó y se volvió a encender, anotar la **nueva IP pública de la EC2 #2** (la privada y la del BFF no cambian: el BFF tiene Elastic IP). Si en algún momento la IP del BFF cambiara, hay que actualizar las **dos** integraciones de la API Gateway (`ANY` y `OPTIONS`) a `http://<IP-DEL-BFF>:8080/{proxy}`.
3. Levantar el frontend en la PC: `npm start` en `cleanfresh-frontend` y abrir
   `http://localhost:3000`.
4. Verificar el sistema completo en la EC2 #2 (ver 3).

## 2. Conectarse a las EC2

En PowerShell, con la llave `.pem` de la key pair:

```powershell
ssh -i "C:\Users\franc\Downloads\key.pem" ec2-user@<IP-PUBLICA-EC2-2>   # microservicios
ssh -i "C:\Users\franc\Downloads\key.pem" ec2-user@3.213.118.143        # BFF (IP fija)
```

El puerto 22 solo acepta tu IP pública. Si hay timeout, tu IP cambió: editar la
regla SSH del grupo de seguridad (`cleanfresh-sg-ms` / `cleanfresh-sg-bff`) y
elegir "My IP".

## 3. Verificación automática (EC2 #2)

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP2/despliegue
./verificar.sh              # comprobación rápida (crea 1 orden de prueba)
./verificar.sh --reiniciar  # además reinicia orders y comprueba persistencia
```

Termina en `Todo OK`. Comprueba contenedores, respuesta de cada servicio,
consulta directa a las tres bases, aislamiento entre bases y los avisos por SQS:
crea una orden y comprueba que le llega el aviso a la sucursal, la despacha y
comprueba que le llega el aviso al cliente, sin duplicados.
Si dice `Permission denied`, usar `bash verificar.sh`.

## 4. Operar los contenedores

**EC2 #2 (microservicios)**, dentro de `EP2/despliegue`:

```bash
docker compose ps                          # estado de los 5 servicios
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
`reportes` (8084), `auditoria` (8085).

**EC2 #1 (BFF)**:

```bash
docker ps --format '{{.Names}} {{.Status}}'
docker logs --since 10m bff 2>&1 | tail -30
curl -s localhost:8080/actuator/health        # {"status":"UP"...} (público)
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/api/orders   # 401 sin token
```

El BFF no registra cada petición; un log vacío es normal. Para actualizarlo:

```bash
cd ~/ms-cleanfresh-bff && git pull && docker build -q -t cleanfresh/bff .
docker rm -f bff
docker run -d --name bff --restart unless-stopped -p 8080:8080 \
  -e COGNITO_ISSUER_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Xj0EYCnUK \
  -e COGNITO_CLIENT_ID=37oq5a3q9ur02q13k6c8rg6mct \
  -e ORDERS_SERVICE_URL=http://172.31.39.91:8081 \
  -e CATALOG_SERVICE_URL=http://172.31.39.91:8082 \
  -e NOTIFICACIONES_SERVICE_URL=http://172.31.39.91:8083 \
  -e REPORTES_SERVICE_URL=http://172.31.39.91:8084 \
  -e AUDITORIA_SERVICE_URL=http://172.31.39.91:8085 \
  cleanfresh/bff
```

## 5. Demostrar cada cosa implementada

### 5.1 Los 5 microservicios en Docker (ACs 13–15)

```bash
docker compose ps                 # EC2 #2: 5 servicios Up, puertos 8081–8085
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

### 5.3 Cola SQS (ACs 9–12)

**Dentro del programa.** En una ventana de la EC2 #2:

```bash
docker compose logs -f notificaciones
```

Crear una orden desde la app como **Cliente**. En unos segundos aparece:
`Notificación: la orden ORD-00XX de <usuario> (...) fue creada`.

Nota: `orders` solo escribe en su log cuando la publicación **falla**
(`No se pudo publicar ORDEN_CREADA...`); cuando sale bien no registra nada. El
lado que publica se ve en la consola de AWS y, indirectamente, en el aviso de
`notificaciones`.

**Fuera del programa (consola de AWS)**, SQS → `cleanfresh-ordenes`:

| Dónde | Qué muestra |
|---|---|
| **Monitoring** | *Number of messages sent* y *deleted* suben con cada orden (tardan 1–5 min) |
| Detalle de la cola | *Messages available* / *in flight*: normalmente `0` (se consume al instante) |
| **Send and receive messages → Poll for messages** | El JSON real del mensaje (`numeroOrden`, `cliente`, `servicio`, `sucursal`, `total`, `fecha`) |

**Desacople** (el mensaje espera si el consumidor está caído):

1. `docker compose stop notificaciones`
2. Crear una orden desde la app: se guarda igual (201).
3. En la consola de SQS: *Messages available: 1*. **Poll for messages** y abrir el
   mensaje para ver el JSON.
4. `docker compose start notificaciones`: a los pocos segundos aparece el aviso en
   su log y *Messages available* vuelve a `0`.

Al sondear desde la consola, el mensaje queda "en vuelo" 30 s; no se pierde.

Hay dos tipos de mensaje en la cola: `ORDEN_CREADA` (al crear una orden) y
`ORDEN_LISTA` (cuando una orden pasa a *Despachado*). `notificaciones` los guarda
como avisos en su base; ver 5.7 para verlos en la app.

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
curl.exe -s -o NUL -w "%{http_code}`n" http://54.162.55.63:8080/api/orders                                  # 401 (BFF directo)
```

### 5.5 Aislamiento de red (AC 16)

Desde la PC (fuera de AWS), estas conexiones **no deben responder**:

```powershell
Test-NetConnection <IP-PUBLICA-EC2-2> -Port 8081      # TcpTestSucceeded : False (también 8082–8085)
Test-NetConnection cleanfresh-db.cjeictyledp6.us-east-1.rds.amazonaws.com -Port 5432   # False
```

En cambio `Test-NetConnection 54.162.55.63 -Port 8080` sí responde: es la única
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

Es el caso que hay que mostrar: el cliente solicita un servicio, el mensaje llega a SQS,
**pero el microservicio de notificaciones está caído**. La solicitud no se pierde: queda
guardada, el mensaje espera en la cola y, cuando `notificaciones` vuelve a levantarse, lo
recibe y genera el aviso.

**Automático (recomendado), en la EC2 #2:**

```bash
cd ~/cleanfresh/cleanfresh-frontend && git pull
cd EP2/despliegue
./demo-desacople.sh
```

El script va narrando seis pasos y verifica cada uno:

1. Estado inicial: todo `Up` y la cola vacía (lee los mensajes directamente de AWS).
2. Detiene `notificaciones` (la "caída") y comprueba que su puerto ya no responde.
3. Crea la solicitud del cliente (`POST /api/orders`): responde **201** y la orden queda
   guardada en la RDS aunque notificaciones esté caído.
4. Muestra que la cola pasó de 0 a **1 mensaje esperando** en SQS y que todavía no existe el aviso.
5. Levanta `notificaciones` de nuevo.
6. Comprueba que consumió el mensaje que esperaba, que apareció el aviso para el Operador de
   Providencia, que la cola volvió a 0 y que hay un solo aviso (sin duplicados).

Termina con `Desacople demostrado: la solicitud sobrevivió a la caída y llegó cuando el
servicio volvió.` Deja `notificaciones` levantado y una orden de prueba "Demo-Desacople-…".
Si dice `Permission denied`, usar `bash demo-desacople.sh`.

**Manual, mostrando la consola de AWS** (para enseñar el mensaje dentro de la cola):

1. En la EC2 #2: `docker compose stop notificaciones`.
2. En la app, como **Cliente**, solicitar un servicio. Funciona igual: la orden aparece en
   "Tus pedidos".
3. Consola de AWS → **SQS → `cleanfresh-ordenes`**: *Mensajes disponibles = 1*. Con **Enviar y
   recibir mensajes → Sondear mensajes** se ve el JSON (`tipo: ORDEN_CREADA`, `numeroOrden`,
   `cliente`, `servicio`, `sucursal`, `total`, `fecha`). Al sondear, el mensaje queda "en vuelo"
   30 s; no se pierde.
4. En la app, como **Operador**: la campanita todavía **no** muestra ese pedido.
5. `docker compose start notificaciones`. A los pocos segundos: en los logs
   (`docker compose logs -f notificaciones`) aparece `Notificación: Nuevo pedido ORD-00XX ...`,
   en SQS *Mensajes disponibles* vuelve a 0 y la campanita del Operador (consulta cada 15 s)
   muestra "Pedido nuevo".

Nota: el contador de SQS es aproximado y puede tardar unos segundos en reflejar el cambio.

## 6. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `redirect_mismatch` al iniciar sesión | El App Client de Cognito debe tener la callback URL exacta `http://localhost:3000/` (con la barra final) |
| El frontend no llama al BFF correcto | `REACT_APP_BFF_URL` en el `.env` del frontend; reiniciar `npm start` tras cambiarlo |
| `orders`/`catalog` reinician en bucle | La base no existe o falla la conexión: `docker compose logs orders`. Ver `ARQUITECTURA.md` (GRANT en RDS) |
| SSH sin respuesta tras reiniciar la EC2 #2 | Memoria agotada; ya está en `t3.medium` con swap persistente. Si pasa: Stop → Start |
| `notificaciones` no registra avisos | Revisar `SQS_ENABLED=true`, `SQS_QUEUE_URL` y el `LabInstanceProfile` de la EC2 #2 |
| La campanita no muestra avisos | Revisar que `notificaciones` esté `Up` y con `SQS_ENABLED=true`, y que el BFF tenga `NOTIFICACIONES_SERVICE_URL` (si falta, apunta a `localhost:8083`). Probar `curl localhost:8083/api/notificaciones` en la EC2 #2 |
| Cambiar el estado de una orden da error en la app | Un Operador solo puede cambiar órdenes de la sucursal que tiene en turno (403 si es de otra). `orders` responde 400 si el estado no es válido |
| 401 con token válido | El token expiró: cerrar sesión y volver a entrar |
| Se cambió la IP pública de la EC2 #2 | Solo afecta al SSH; el BFF usa la IP privada `172.31.39.91` |

## 7. Al terminar la evaluación

Las 2 EC2, la RDS y la API Gateway son recursos reales y **cobran mientras
existan**. Eliminarlos o detenerlos en la consola (EC2 → Terminate/Stop,
RDS → Delete o Stop temporarily, API Gateway → Delete). La cola SQS y el User
Pool de Cognito tienen costo despreciable en este uso, pero también se pueden
borrar.
