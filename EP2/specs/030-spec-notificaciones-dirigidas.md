---
id: 030
type: spec
status: approved
---

# Spec 030 — Notificaciones dirigidas por SQS: aviso al Operador y al Cliente

## Qué debe hacer

Hoy (Spec 029) `orders` publica `ORDEN_CREADA` y `notificaciones` solo escribe
una línea en su log: nadie recibe nada, y no existe ningún evento de "pedido
listo" porque `orders` no permite cambiar el estado de una orden. Esta spec
completa la idea original del uso de SQS:

- **Al Operador** le llega un aviso cuando entra un pedido nuevo en su sucursal.
- **Al Cliente** le llega un aviso cuando su pedido está listo (pasa a
  *Despachado*).
- Los avisos se **guardan** (base propia de `notificaciones`) y se **ven en la
  app** con una campanita y un contador de no leídas, filtrados por rol en el
  servidor.

Para que exista el aviso "listo", el cambio de estado deja de vivir solo en el
navegador: `orders` pasa a tener un endpoint para cambiarlo, con su ruta en el
BFF, y el panel del Operador y del Admin lo usan.

Se reutiliza la misma cola `cleanfresh-ordenes`; el campo `tipo` del mensaje
distingue `ORDEN_CREADA` de `ORDEN_LISTA`. No hay recursos nuevos de AWS salvo
una base más (`notificaciones_db`) dentro de la misma RDS.

## Fuera de alcance

- Envío real de correo, SMS o push (los avisos son solo dentro de la app).
- Tiempo real con websockets: la app consulta cada 15 segundos.
- Cambiar otros estados además de *Despachado* para notificar (aceptado, en
  preparación, entregado). Es una constante fácil de ampliar.
- Cola de mensajes fallidos (DLQ) y entrega exactamente una vez: se mantiene
  "al menos una vez", con deduplicación en la base.
- Corregir que `GET /api/orders` devuelva todas las órdenes a un Cliente (hoy la
  pantalla las filtra en el navegador). Es un pendiente aparte, anotado en
  `CLAUDE.md`; las notificaciones sí se filtran en el servidor.
- Validar el JWT dentro de los microservicios (siguen confiando en el BFF).

## Decisiones de diseño

- **"Listo" = estado `DESPACHADO`.** El flujo es CREADO → ACEPTADO →
  EN_PREPARACION → DESPACHADO → ENTREGADO; "listo" es cuando sale de
  preparación.
- **Destinatarios:** `ORDEN_CREADA` → la **sucursal** de la orden (le llega al
  Operador que esté en turno en esa sucursal, igual que sus órdenes). `ORDEN_LISTA`
  → el **cliente** dueño de la orden (su `username` de Cognito, que es lo que ya
  guarda `orders` en `cliente`).
- **Identificador de la orden en la API:** `numeroOrden` (`ORD-0008`), porque es
  lo que usa el frontend.
- **Deduplicación:** una notificación es única por (`tipo`, `numeroOrden`); si
  SQS entrega el mismo mensaje dos veces, no se duplica el aviso.
- **Marcar como leídas:** una sola operación sobre "las notificaciones de quien
  llama" (el BFF aplica el filtro), sin comprobar propiedad una por una.

## Acceptance Criteria

**`orders` — cambio de estado y evento**

1. `PUT /api/orders/{numeroOrden}/estado` con `{ "estado": "..." }` cambia el
   estado, lo guarda en la base y devuelve la orden actualizada. Estado fuera del
   flujo → `400`; orden inexistente → `404`.
2. Al pasar una orden a `DESPACHADO` se publica `ORDEN_LISTA` en SQS (con
   `numeroOrden`, `cliente`, `servicio`, `sucursal`, `total`, `fecha`), después de
   confirmarse la transacción. Repetir el mismo estado no vuelve a publicar.
3. Cualquier otro cambio de estado no publica nada. Si la publicación falla, el
   cambio de estado queda guardado igual y el error se registra (mismo criterio
   que `ORDEN_CREADA`).

**`notificaciones` — guardar y exponer**

4. Tiene su propia base `notificaciones_db`, con su propio usuario, y la conexión
   llega solo por variables de entorno.
5. Al consumir `ORDEN_CREADA` guarda una notificación dirigida a la sucursal de la
   orden; al consumir `ORDEN_LISTA`, una dirigida al cliente. El mensaje de SQS se
   elimina solo después de guardar.
6. Un mismo mensaje entregado dos veces no crea dos notificaciones.
7. `GET /api/notificaciones?cliente=` y `?sucursal=` devuelven las del
   destinatario indicado, de la más nueva a la más vieja; `PUT
   /api/notificaciones/leidas` con el mismo filtro las marca como leídas. Sin
   ningún filtro, `GET` devuelve todas (uso del Admin).

**BFF**

8. `PUT /api/orders/{numeroOrden}/estado` solo para `Admin` y `Operador`
   (`@PreAuthorize`); el Operador solo puede cambiar órdenes de la sucursal que
   tiene en turno. `Cliente` → `403`, sin token → `401`.
9. `GET /api/notificaciones` devuelve, según el rol: al **Cliente**, solo las
   suyas (por el `username` del JWT, nunca por un parámetro del cliente); al
   **Operador**, las de la sucursal pedida (validada como en las órdenes); al
   **Admin**, todas. `POST /api/notificaciones/leidas` marca como leídas las del
   mismo alcance, salvo el Admin: es solo lectura para él (no marca nada), para
   que abrir su campanita no borre los avisos pendientes de los Operadores y
   Clientes.

**Frontend**

10. El Operador y el Admin cambian el estado de una orden llamando al backend; si
    la llamada falla, la pantalla muestra el error y no cambia el estado.
11. Una campanita con contador de no leídas aparece en las tres vistas y consulta
    cada 15 s. Al abrirla muestra los avisos (tipo, orden, mensaje y hora) y los
    marca como leídos.
12. Flujo completo con los tres roles: un Cliente solicita un servicio → el
    Operador de esa sucursal ve el aviso; el Operador pasa la orden a
    *Despachado* → el Cliente dueño ve el aviso y ningún otro Cliente lo ve.

**Compatibilidad, red y cierre**

13. Los contratos de EP1/029 no cambian (`GET /api/orders`, `GET /api/catalog`,
    `POST /api/orders`, reportes y auditoría) y siguen los tests existentes.
14. Sin AWS configurado (local), `orders` y `notificaciones` siguen funcionando
    con SQS apagado.
15. Desplegado en AWS: `notificaciones_db` creada en la RDS con su usuario (sin
    acceso a las otras bases, y sin que los otros usuarios entren a ella);
    `docker-compose.yml`, `verificar.sh` y `GUIA-DEMOSTRACION.md` actualizados.
16. Evidencia en `EP2/EVIDENCIA-EP2.md`: los avisos en la base, en la app y la
    cola con ambos tipos de mensaje.

## Verificación

Orden de trabajo: fase 1 `orders`, fase 2 `notificaciones`, fase 3 BFF, fase 4
frontend, fase 5 AWS y cierre. Las fases 1–4 se prueban primero en local (Postgres
y ElasticMQ en Docker); la fase 5 en AWS.

**Fase 1 — `orders` (hecha, solo local).** Probada con el jar real contra
PostgreSQL y ElasticMQ.

| # | AC | Estado |
|---|---|---|
| 1 | `PUT /api/orders/ORD-0013/estado` con `aceptado` y `EN_PREPARACION` → 200 (acepta minúsculas y se guarda en mayúsculas); `VOLANDO` → 400; `ORD-9999` → 404. Tests: 3 de controlador y 3 de servicio | ✅ Cumple (local) |
| 2 | Dos `PUT` seguidos a `DESPACHADO` dejaron **un solo** `ORDEN_LISTA` en la cola, con `numeroOrden`, `cliente`, `servicio`, `sucursal`, `total` y `fecha`; se publica tras confirmarse la transacción (`AFTER_COMMIT`) | ✅ Cumple (local) |
| 3 | `ACEPTADO`, `EN_PREPARACION` y `ENTREGADO` no publican nada (test); si la publicación de `ORDEN_LISTA` falla, el estado queda guardado (test) | ✅ Cumple (tests) |

Cambios de apoyo: `OrdenCreadaMessage` pasó a `OrdenMessage` (lleva `tipo` y
sirve para ambos eventos), `OrdenCreadaListener` a `OrdenEventListener`, y el
publicador tiene ahora `publishCreada` y `publishLista`. 15 tests en verde.

**Fase 2 — `notificaciones` (hecha, solo local).** Probada con los jars reales de
`orders` y `notificaciones` contra PostgreSQL y ElasticMQ.

| # | AC | Estado |
|---|---|---|
| 4 | Base `notificaciones_db` con `notificaciones_user`; conexión solo por `DB_URL`/`DB_USER`/`DB_PASSWORD` sin valores por defecto. Aislamiento comprobado en las dos direcciones: `orders_user` y `catalog_user` no entran a `notificaciones_db`, y `notificaciones_user` no entra a `orders_db` (`permission denied`) | ✅ Cumple (local) |
| 5 | `POST` de `ORD-0014` (Providencia) → aviso `ORDEN_CREADA` dirigido a la sucursal Providencia: "Nuevo pedido ORD-0014: Planchado de cliente-uuid-A en Providencia (total $9.500)". `PUT ... DESPACHADO` → aviso `ORDEN_LISTA` dirigido al cliente `cliente-uuid-A`: "Tu pedido ORD-0014 (Planchado) está listo". Cada mensaje se elimina de la cola solo tras guardarse | ✅ Cumple (local) |
| 6 | Reenvié a mano el mismo `ORDEN_LISTA` a la cola: el consumidor lo procesó y los avisos del cliente siguieron en 1. Tests: mensaje repetido y mismo número con otro tipo | ✅ Cumple (local) |
| 7 | `GET ?cliente=` (el cliente B no ve el aviso de A), `?sucursal=` (Providencia no ve el de Las Condes) y sin filtro (todos, del más nuevo al más viejo); `PUT /leidas?cliente=` devolvió `{"marcadas":1}` y solo cambió a ese cliente. Filtro en blanco o los dos a la vez → 400 (tests) | ✅ Cumple (local) |

Pruebas adicionales con el consumidor realmente detenido (se mató el proceso y se
comprobó que el puerto no respondía): `orders` siguió respondiendo (`POST` 201 y
`PUT` 200), dos mensajes esperaron en la cola y, al volver `notificaciones`, se
guardaron; los avisos anteriores y su estado "leído" seguían en la base (5 filas).
Tests: 17 en `notificaciones` (servicio, controlador, consumidor) y 15 en `orders`.

Cambios de apoyo: `OrdenCreadaMessage` pasó a `OrdenMessage` (lleva `tipo`) y el
servicio ahora ignora los tipos desconocidos en vez de reintentarlos para siempre.
Nota de proceso: una primera prueba de "reinicio" no reinició nada (`pkill` no
existe en esta shell y el error estaba oculto); se repitió matando el proceso con
PowerShell, y esa es la que vale.

**Fase 3 — BFF (hecha, por tests).** El BFF completo no arranca en local con un
token real (no hay forma de obtener uno desde aquí), así que se probó con tests:
autorización con `jwt()` simulado y los repositorios contra un servidor HTTP
simulado. Falta comprobarlo en vivo con tokens reales de Cognito (fase 5).

| # | AC | Estado |
|---|---|---|
| 8 | `PUT /api/orders/{numeroOrden}/estado`: sin token 401; Cliente 403 (y no se llama a `orders`); Operador con la sucursal en turno 200; Operador con una orden de otra sucursal 403; Operador sin sucursal en turno 403; orden inexistente 404; Admin cualquier orden 200; el 400 y el 404 de `orders` se traducen a 400 y 404 | ✅ Cumple (tests) |
| 9 | `GET /api/notificaciones`: sin token 401; el Cliente ve solo las suyas por el `username` del token y no puede ver las de otro mandando `cliente` o `sucursal` como parámetros (se verifica que nunca se consulta con ellos); el Operador ve las de la sucursal en turno y, sin sucursal válida, nada (ni se consulta el servicio); el Admin ve todas. `POST /api/notificaciones/leidas`: el Cliente marca las suyas, el Operador las de su sucursal, el Admin no marca nada | ✅ Cumple (tests) |

Pruebas HTTP de los repositorios (`RepositoriosHttpTests`): `?cliente=ana-uuid`,
`?sucursal=Las%20Condes` y `?sucursal=%C3%91u%C3%B1oa` se arman y codifican bien;
`PUT .../leidas` y `PUT /api/orders/ORD-0014/estado` con `{"estado":"DESPACHADO"}`
en el cuerpo; el 404 y el 400 de `orders` llegan como excepciones tipadas.
33 tests en verde en el BFF.

Cambios de apoyo: la lógica de roles y sucursal que estaba privada en
`OrderService` pasó a un componente compartido, `AccesoPorRol`, que usan órdenes y
notificaciones. Limitación conocida: para validar la sucursal de una orden el
Operador, el BFF busca la orden entre todas las que devuelve `orders`, porque
ese servicio no tiene consulta por número de orden; con datos de este tamaño es
aceptable.

**Fase 4 — frontend (hecha, con el BFF simulado).** Se probó la app compilada
(`npm run build`, sin advertencias) en Chrome sin interfaz, con una sesión de
Cognito simulada y respuestas simuladas del BFF (interceptadas en el navegador).
Comprueba la pantalla real y las llamadas que hace, no el backend: eso queda para
la fase 5.

| # | AC | Estado |
|---|---|---|
| 10 | El Operador cambia el estado desde "Ver → Ajustar estado → Confirmar cambio" y se llama a `PUT /api/orders/ORD-0014/estado?sucursal=Providencia` con `{"estado":"DESPACHADO"}`; el Admin, desde su modal "Guardar cambios", llama al mismo `PUT` sin sucursal. Con el backend respondiendo 403, ambos muestran "No se pudo cambiar la orden ORD-0014: no tienes permiso sobre esa orden." y la orden **sigue en "En preparación"** | ✅ Cumple (BFF simulado) |
| 11 | La campanita aparece en las tres vistas. Cliente y Operador ven el contador (1), el panel con el aviso resaltado ("Pedido listo" / "Pedido nuevo") y, al abrirlo, se llama a `POST /api/notificaciones/leidas` (el Operador con su sucursal) y el contador desaparece. El Admin ve los dos avisos en modo lectura, sin contador y sin llamar a `leidas`. Se consulta al abrir y cada 15 s | ✅ Cumple (BFF simulado) |
| 12 | Flujo completo con los tres roles contra el backend real | ⏳ Fase 5 (AWS) |

Detalles: se encontró y corrigió una carrera al abrir el panel (pedir la lista y
marcar como leídos a la vez dejaba que una respuesta vieja devolviera el
contador); ahora se marca primero y se refresca después. La pantalla solo
refleja un cambio de estado si el backend lo aceptó. Componente nuevo:
`src/components/NotificationBell.jsx`. Limitación: el `App.test.js` heredado de la
plantilla ya estaba roto (usa `@testing-library`, que no está instalado) y no se
tocó; la verificación de esta fase fue con el navegador, no con tests unitarios.

Fase 5: ⏳ pendiente.
