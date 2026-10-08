---
id: 032
type: spec
status: approved
---

# Spec 032 — Nombre legible del cliente en órdenes y avisos, y sucursal elegible al solicitar

## Qué debe hacer

**A. Nombre legible.** Hoy una orden creada por un cliente real guarda como `cliente` el
`username` de Cognito (un UUID como `64888468-1021-70ae-…`) y eso es lo que se ve en las
listas del Admin y del Operador y en los avisos ("Nuevo pedido ORD-0012: … de
64888468-… en Providencia"). El access token de Cognito no trae nombre ni correo, solo
ese identificador. Esta spec guarda además un **nombre legible** (el correo o el nombre
del usuario en Cognito) y lo muestra en pantallas y avisos, **sin tocar el identificador**
que se usa para saber de quién es cada orden.

**B. Sucursal del cliente.** El Cliente ya puede elegir la sucursal dentro de la ventana
"Solicitar…", pero queda escondida en un desplegable y el catálogo no dice en qué sucursal
está disponible cada servicio. Se agrega un selector **"Sucursal"** visible arriba del
catálogo del Cliente: las tarjetas muestran si el servicio está disponible en esa sucursal
y la ventana de solicitud la trae preseleccionada (sigue pudiendo cambiarla).

## Por qué el nombre sale de Cognito y no del navegador

Si el navegador mandara su propio nombre en el pedido, cualquier cliente podría poner el
que quisiera. En cambio el BFF se lo pregunta a Cognito con el propio access token
(endpoint `/oauth2/userInfo` del dominio del Hosted UI), así que el nombre es el real y no
se puede falsificar. Si Cognito no lo devuelve o falla la consulta, la orden se crea igual
y se muestra el identificador, como hoy.

## Fuera de alcance

- Que el usuario edite su nombre desde la app.
- Cambiar quién es el dueño de una orden: sigue siendo el `username` del token (así "Tus
  pedidos" y los avisos al cliente siguen funcionando).
- Corregir que `GET /api/orders` entregue todas las órdenes a un Cliente (pendiente de
  seguridad aparte, en `CLAUDE.md`).
- Mejorar las órdenes de ejemplo de EP1 (ya tienen nombres legibles).

## Decisiones de diseño

- **Campo nuevo y opcional `clienteNombre`** junto a `cliente`: las órdenes anteriores no
  lo tienen y se siguen mostrando con `cliente`. Ningún contrato existente cambia.
- **Nombre mostrado = `name` de Cognito si el usuario lo tiene; si no, su `email`**; si
  tampoco, el `username`. Poner un nombre a los usuarios de prueba en la consola de Cognito
  (atributo `name`, por ejemplo "Cliente Demo") hace que se vea mejor que el correo.
- **El BFF necesita el dominio del Hosted UI** (`COGNITO_DOMAIN`, variable nueva) y guarda
  en memoria el nombre ya consultado para no llamar a Cognito en cada pedido.
- **Sucursal por defecto del Cliente:** la primera de la lista; la elección no se guarda
  entre sesiones.

## Acceptance Criteria

**Nombre legible**

1. `orders` guarda y devuelve `clienteNombre` (opcional) en `POST /api/orders` y en las
   consultas. Una orden sin nombre se sigue mostrando con su `cliente`.
2. Al crear una orden, el BFF obtiene el nombre desde Cognito con el access token del
   usuario (nunca del cuerpo de la petición). Si la consulta falla o no trae nombre, la
   orden se crea igual con el `username` como respaldo.
3. Los avisos usan el nombre legible: "Nuevo pedido ORD-0007: Lavado en seco de
   cliente@cleanfresh.com en Providencia". El destinatario del aviso de "pedido listo"
   sigue siendo el `username` (no cambia quién lo ve).
4. Admin, Operador y Cliente ven el nombre legible en las listas de órdenes. "Tus
   pedidos" sigue encontrando las órdenes del cliente por su identificador, no por el
   nombre.
5. La búsqueda por cliente encuentra tanto por el nombre legible como por el
   identificador.

**Sucursal del cliente**

6. El catálogo del Cliente tiene un selector de sucursal visible; cada tarjeta indica si
   el servicio está disponible en la sucursal elegida y "Solicitar" se desactiva si no lo
   está.
7. La ventana "Solicitar…" abre con la sucursal elegida y permite cambiarla entre las
   sucursales donde el servicio está disponible; la orden se crea en la sucursal
   confirmada.

**Compatibilidad y cierre**

8. Los contratos existentes no cambian y los tests actuales siguen en verde; los
   servicios arrancan con el campo nuevo sobre la base ya existente (`ddl-auto: update`
   agrega la columna sin perder datos).
9. Probado en el entorno real: un Cliente crea una orden y el Admin, el Operador y los
   avisos muestran su nombre legible; elige una sucursal distinta de Providencia y la
   orden queda en esa sucursal. Evidencia en `EP2/EVIDENCIA-EP2.md`.

## Verificación

Fases 1 a 4 hechas (`orders`, `notificaciones`, BFF y frontend). Se probó con tests
automáticos y con la app compilada en Chrome sin interfaz, con sesión de Cognito y respuestas del
BFF simuladas (como en las Specs 030 y 031). **Falta el despliegue y la prueba en el entorno real**
(AC 9): ahí se comprueba contra Cognito de verdad y contra PostgreSQL en la RDS.

| # | AC | Estado |
|---|---|---|
| 1 | `orders` guarda y devuelve `clienteNombre`; sin nombre o con nombre en blanco queda `null`; las órdenes de ejemplo no lo tienen y se muestran con su `cliente`. 22 tests (incluye `SqsOrderEventPublisherTests`) | ✅ Cumple (tests, con H2) |
| 2 | El BFF pide el nombre a Cognito con el access token del usuario (`/oauth2/userInfo`, cabecera `Authorization: Bearer <token>`): prefiere `name`, luego `email`, y si falla o viene vacío usa el `username`. Un test con una orden que trae `cliente` y `clienteNombre` falsos en el cuerpo comprueba que **se ignoran** y se usan los del token y de Cognito. Cada respuesta exitosa se guarda en memoria una hora; un fallo no se guarda y se reintenta. 9 + 2 tests. El endpoint existe en el dominio real (sin token responde 400, con un token falso 401) | ✅ Cumple (tests); la respuesta real de Cognito se ve en el AC 9 |
| 3 | Los avisos de pedido nuevo muestran el nombre legible ("… de cliente@cleanfresh.com en Providencia"), con el identificador como respaldo; el aviso de pedido listo sigue dirigido al identificador (se encuentra por él y no por el nombre). El mensaje de SQS lleva `clienteNombre` (verificado sobre el JSON real). 20 tests | ✅ Cumple (tests) |
| 4 | Admin, Operador y Cliente ven el nombre legible; una orden sin él se ve con el nombre de siempre ("Maria Gonzalez") o con el identificador. "Tus pedidos" sigue mostrando solo las del cliente, comparando por el identificador | ✅ Cumple (BFF simulado) |
| 5 | Buscar por el nombre legible (`cliente@cleanfresh`) y por el identificador (`64888468-1021`) encuentra la orden, en Admin y Operador | ✅ Cumple (BFF simulado) |
| 6 | Selector de sucursal visible en el catálogo del Cliente. En Providencia todo está disponible; en Maipú "Lavado de edredones" y "Servicio exprés" pasan a *No disponible* y su botón se desactiva, y "Lavado y secado" sigue disponible | ✅ Cumple (BFF simulado) |
| 7 | La ventana de solicitud abre con la sucursal elegida (Maipú), deja cambiarla (Las Condes) y la orden se crea en la sucursal confirmada: el pedido sale con `{servicio, total, sucursal: "Las Condes"}`, sin `cliente` ni `clienteNombre` | ✅ Cumple (BFF simulado) |
| 8 | Contratos sin cambios: `OrderRequest` y `OrderResponse` ganan un campo opcional al final y conservan el constructor anterior; 22 tests en `orders`, 20 en `notificaciones` y 44 en el BFF, todos en verde. La columna nueva (`cliente_nombre`, opcional) la agrega `ddl-auto: update` al desplegar; con H2 se prueba, con PostgreSQL se confirma en el AC 9 | ✅ Cumple (tests) |
| 9 | Probado en el entorno real: un Cliente crea una orden y las listas y los avisos muestran su nombre legible; elige una sucursal distinta de Providencia y la orden queda ahí | ⏳ Pendiente de despliegue |

Detalles de la prueba en el navegador: una primera comprobación del Cliente falló por un error de
la propia prueba (exigía que ninguna orden mostrara el identificador, cuando la simulación incluye
una orden sin nombre legible que debe verse así); se acotó la comprobación y no la app.

Límites: el nombre legible se resuelve al **crear** la orden: si el usuario cambia su nombre en
Cognito después, las órdenes ya creadas conservan el anterior. Las órdenes anteriores a esta spec
no tienen nombre legible y se muestran con su identificador. En Cognito, el atributo `name` de cada
usuario de prueba (por ejemplo "Cliente Demo") se muestra en lugar del correo.
