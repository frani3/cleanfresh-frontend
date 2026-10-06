---
id: 029
type: spec
status: approved
---

# Spec 029 — Arquitectura EP2: persistencia, contenedores, mensajería y nuevos microservicios

## Qué debe hacer

Implementa la arquitectura objetivo de [`EP2/ARQUITECTURA.md`](../ARQUITECTURA.md)
sobre lo que dejó la Spec 028 (EP1: BFF y microservicios en EC2 detrás de
API Gateway, datos en memoria):

- `orders` y `catalog` guardan sus datos en **PostgreSQL (RDS)** con JPA, una
  base por servicio.
- Se crean tres microservicios nuevos: `notificaciones` (8083), `reportes`
  (8084) y `auditoria` (8085). `reportes` y `auditoria` son **esqueletos con
  respuesta fija** en esta entrega.
- `orders` publica `ORDEN_CREADA` en **AWS SQS** y `notificaciones` la consume.
- Todo corre en **Docker**: los 5 microservicios con `docker-compose` en la
  EC2 #2 y el BFF en la EC2 #1. Sin Kubernetes.
- Los microservicios confían totalmente en el BFF (no validan JWT) y por eso
  solo son alcanzables desde la EC2 del BFF.

## Fuera de alcance

- La lógica real de `reportes` y `auditoria` (siguiente entrega).
- Envío real de correos desde `notificaciones` (solo registra el aviso).
- Cambios en el frontend: sigue igual, apuntando a API Gateway.
- Validar el JWT dentro de los microservicios.
- Migraciones versionadas (Flyway) y alta disponibilidad de la base de datos.

## Acceptance Criteria

**Persistencia**

1. `orders` guarda las órdenes en PostgreSQL (`orders_db`) con JPA: una orden
   creada con `POST /api/orders` sigue existiendo después de reiniciar el
   servicio.
2. `catalog` guarda el catálogo en PostgreSQL (`catalog_db`) con JPA, incluida
   la disponibilidad por sucursal. Con la base vacía se siembra con los mismos
   5 servicios de EP1.
3. Cada servicio usa su propio usuario de base de datos y solo puede acceder a
   su base.
4. URL, usuario y contraseña de la base llegan solo por variables de entorno;
   ningún secreto queda en el repositorio.
5. Los contratos JSON de EP1 no cambian (`GET /api/orders`, `GET /api/catalog`,
   `POST /api/orders`): el frontend funciona sin tocar código.

**Microservicios nuevos y BFF**

6. Existen `ms-cleanfresh-notificaciones` (8083), `ms-cleanfresh-reportes`
   (8084) y `ms-cleanfresh-auditoria` (8085): Spring Boot 4.1.1 / Java 21,
   compilan, cada uno en su propio repositorio con README y `.gitignore`.
7. `reportes` y `auditoria` exponen un `GET` con respuesta fija, con las mismas
   formas de datos que hoy usa el panel Admin (`[{branch, orders}]` y
   `[{time, actor, action, level}]`). No tienen base de datos ni llaman a otros
   servicios.
8. El BFF expone `GET /api/reportes` y `GET /api/auditoria` solo para el rol
   Admin (`@PreAuthorize`), reenviando a esos servicios. `notificaciones` no
   tiene ruta en el BFF (solo recibe mensajes de SQS).

**Mensajería (SQS)**

9. Al crear una orden, `orders` publica un mensaje `ORDEN_CREADA` en la cola SQS
   con `numeroOrden`, `cliente`, `servicio`, `sucursal`, `total` y `fecha`.
10. `notificaciones` consume ese mensaje, registra un aviso en su log y lo
    elimina de la cola.
11. Desacople: con `notificaciones` caído, `POST /api/orders` sigue respondiendo
    201 y el mensaje espera en la cola hasta que el consumidor vuelve. Si la
    publicación a SQS falla, la orden se crea igual y el error se registra.
12. Sin AWS configurado (desarrollo local), `orders` funciona igual: la
    publicación se desactiva por configuración.

**Contenedores**

13. Cada servicio (BFF incluido) tiene `Dockerfile` y su imagen arranca
    configurada solo por variables de entorno.
14. Un `docker-compose.yml` levanta los 5 microservicios en la EC2 #2 mapeando
    8081–8085, con `restart: unless-stopped`: tras reiniciar la EC2 vuelven
    solos.
15. El BFF corre en Docker en la EC2 #1 (:8080).

**Red y seguridad**

16. La EC2 #2 acepta 8081–8085 solo desde la EC2 #1, y RDS acepta 5432 solo
    desde la EC2 #2 (comprobable: una conexión externa a `:8081` no responde).
17. Sin regresión de seguridad: el BFF sigue validando el JWT y autorizando por
    rol (401 sin token, 403 con rol insuficiente, 200 con token válido). Los
    microservicios no validan JWT.

**Integración y cierre**

18. El flujo frontend → API Gateway → BFF → microservicios funciona con los 3
    roles (Admin, Operador, Cliente) sobre el nuevo despliegue.
19. Las EC2 de EP1 que dejan de usarse se apagan o eliminan una vez verificado
    el nuevo despliegue.
20. La evidencia de EP2 (comandos y capturas) queda en `EP2/EVIDENCIA-EP2.md`.

## Verificación

La implementación avanza por fases (ver el plan en el chat de aprobación); esta
tabla se completa a medida que cada fase se prueba.

**Fase 1 — persistencia (hecha, solo local).** Probada contra PostgreSQL 16 en
Docker en la máquina de desarrollo, no contra RDS (la RDS se crea en la fase 5).
Los tests automáticos usan H2.

| # | AC | Estado |
|---|---|---|
| 1 | `POST /api/orders` creó `ORD-0007` (id 7, `CREADO`); tras reiniciar el servicio sigue en `GET /api/orders` (7 órdenes) y la semilla no se duplicó | ✅ Cumple (local) |
| 2 | `catalog` sirve los 5 servicios desde `catalog_db`, con 20 filas en `servicio_sucursal` (4 sucursales × 5); test comprueba que "Lavado de edredones" conserva `disponible=false` y Las Condes/Maipú en `false` | ✅ Cumple (local) |
| 3 | `orders_user` y `catalog_user` solo conectan a su base: cada uno recibe `permission denied for database` (`User does not have CONNECT privilege`) en la del otro | ✅ Cumple (local) |
| 4 | `application.yaml` usa `${DB_URL}`/`${DB_USER}`/`${DB_PASSWORD}` sin valores por defecto; sin ellas el servicio sale con código 1; no hay contraseñas literales en `src/main` ni `.env` en git | ✅ Cumple |
| 5 | Mismos campos JSON que EP1 en `GET /api/orders` y `GET /api/catalog` (inspección de las respuestas); el frontend no se modificó | ✅ Cumple por inspección; falta repetirlo a través del BFF cuando haya Cognito |
Pruebas automáticas añadidas: `OrderServiceTests` (3) y `CatalogServiceTests`
(3), más el `contextLoads` existente, todos en verde. Nota: al probar con `curl`
desde Git Bash, un carácter con tilde llegó en codificación Windows y el
servicio respondió 400; es un efecto del cliente de prueba (con UTF-8 explícito
funciona), no del servicio.

**Fase 2 — microservicios nuevos y rutas del BFF (hecha, solo local).**

| # | AC | Estado |
|---|---|---|
| 6 | Existen `ms-cleanfresh-notificaciones` (8083), `-reportes` (8084) y `-auditoria` (8085): Spring Boot 4.1.1 / Java 21, `mvnw clean package` en verde en los tres (tests incluidos), cada uno con README, `.gitignore` y su propio repositorio git local. Los tres arrancaron en su puerto | ✅ Cumple. Repos públicos creados en GitHub (`frani3/ms-cleanfresh-notificaciones`, `-reportes`, `-auditoria`) con su commit inicial subido |
| 7 | `GET /api/reportes` (8084) y `GET /api/auditoria` (8085) respondieron 200 con las formas `[{branch, orders}]` y `[{time, actor, action, level}]`; sin base de datos ni llamadas a otros servicios | ✅ Cumple |
| 8 | En el BFF, `/api/reportes` y `/api/auditoria` con `@PreAuthorize("hasRole('Admin')")` y reenvío por `RestClient`. Tests (con `jwt()` simulado y repositorios mockeados): 401 sin token, 403 con Operador y Cliente, 200 con Admin y los datos del servicio. `notificaciones` no tiene ruta en el BFF | ✅ Cumple por tests; falta probarlo en vivo con un token real de Cognito (fase 5) |

Cambios de apoyo: el BFF tenía solo el test `contextLoads`, que ya no podía
correr sin un Cognito existente (el `JwtDecoder` real consulta al emisor al
crearse). Ahora ese test, y los nuevos, reemplazan el decoder por un mock y
corren sin red (8 tests en verde). El User Pool de EP1 ya no existe (el
emisor responde 404), así que el BFF completo no puede arrancar en local hasta
recrear Cognito.

**Fase 3 — SQS (hecha, solo local con ElasticMQ).** Probada contra ElasticMQ,
un emulador de SQS compatible con la API, no contra AWS: la cola real se crea
en la fase 5. Cola `cleanfresh-ordenes`.

| # | AC | Estado |
|---|---|---|
| 9 | `POST /api/orders` creó `ORD-0008`; `orders` publicó `ORDEN_CREADA` en la cola (con `numeroOrden`, `cliente`, `servicio`, `sucursal`, `total`, `fecha`), después de confirmarse la transacción (`@TransactionalEventListener(AFTER_COMMIT)`) | ✅ Cumple (local) |
| 10 | `notificaciones` consumió el mensaje y registró "Notificación: la orden ORD-0008 de Cliente Cola (Planchado, sucursal Providencia, total 15000.0) fue creada"; la cola quedó en 0 mensajes (se elimina solo tras procesar bien) | ✅ Cumple (local) |
| 11 | Con `notificaciones` caído: `POST` → 201 (`ORD-0009`), el mensaje esperó en la cola (visibles=1) y, al volver el consumidor, se procesó (aviso de `ORD-0009`, cola en 0). Con SQS inalcanzable: `POST` → 201 (`ORD-0010`) y el log dice "No se pudo publicar ORDEN_CREADA de ORD-0010 en SQS; la orden ya quedó creada" | ✅ Cumple (local) |
| 12 | Sin ninguna variable de AWS: `POST` → 201 (`ORD-0011`) y no se crea ningún bean de SQS (`app.sqs.enabled=false` por defecto) | ✅ Cumple |

Pruebas automáticas añadidas: `OrderEventTests` (2, en `orders`) y
`NotificationServiceTests` (3) y `OrderQueuePollerTests` (2) en `notificaciones`.

Límites conocidos, fuera de alcance: la entrega de SQS es "al menos una vez" (un
mensaje puede repetirse) y un mensaje inválido se reintenta indefinidamente
porque no hay cola de mensajes fallidos (DLQ). Al matar el consumidor en pleno
long polling, su mensaje queda "no visible" hasta que vence el tiempo de
visibilidad (30 s) y vuelve a la cola; es comportamiento normal de SQS.

**Fase 4 — contenedores (hecha, solo local con Docker Desktop).** `Dockerfile`
multi-etapa (Maven + JDK 21 → JRE 21, usuario sin root) y `.dockerignore` en los
6 repos; `docker-compose.yml` en [`EP2/despliegue/`](../despliegue/README.md).
Probado contra el Postgres local, no contra RDS ni en una EC2.

| # | AC | Estado |
|---|---|---|
| 13 | Las 6 imágenes se construyen (`cleanfresh/<servicio>`, 504–587 MB). Los 5 microservicios arrancaron solo con variables de entorno: `orders` y `catalog` respondieron 200 con los datos de sus bases (`host.docker.internal`), `reportes` y `auditoría` 200, `notificaciones` arrancó. El proceso corre como `appuser` (no root). La imagen del BFF arranca, lee sus variables y falla solo al resolver el emisor de Cognito (el User Pool de EP1 ya no existe) | ✅ Cumple (local); BFF completo pendiente de Cognito (fase 5) |
| 14 | `docker compose up -d --build` levantó los 5 con 8081–8085 mapeados; los 5 contenedores tienen `RestartPolicy=unless-stopped`; tras `docker compose restart orders` siguen las mismas 11 órdenes | ✅ Cumple (local). Que vuelvan tras reiniciar la EC2 requiere además `systemctl enable docker` (documentado) y se prueba en la fase 5 |
| 15 | `Dockerfile` del BFF listo y la imagen construye y arranca; correrla en la EC2 #1 (:8080) | ⏳ Pendiente de la fase 5 |

Límite conocido: SQS dentro de Docker no se probó (en la fase 3 se probó con los
jars); se comprobará contra la cola real en la fase 5.

**Fases 5–6:** ACs 16–20, ⏳ pendientes.
