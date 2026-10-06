# Evidencia EP1 — Guía paso a paso para el profesor

Esta guía muestra, paso a paso, cómo comprobar los dos indicadores de
la pauta de EP1 (Login/Cognito 60% + BFF 40%) sobre este proyecto. No
requiere leer el código para creerlo: cada punto tiene una acción
concreta (click, curl, F12) y qué se espera ver.

> El proyecto usa AWS Cognito como proveedor de identidad (antes usaba
> Azure AD/MSAL; el requisito de la pauta cambió). La mecánica que se
> evalúa es la misma: login delegado a un tercero, roles leídos del
> token, y un backend que valida ese token antes de responder.

## Antes de empezar

Levantar los 4 servicios en este orden (detalle de cada uno en su
propio README):

```powershell
# Terminal 1 — ms-cleanfresh-orders (:8081)
cd ms-cleanfresh-orders
.\mvnw.cmd spring-boot:run

# Terminal 2 — ms-cleanfresh-catalog (:8082)
cd ms-cleanfresh-catalog
.\mvnw.cmd spring-boot:run

# Terminal 3 — ms-cleanfresh-bff (:8080)
cd ms-cleanfresh-bff
$env:COGNITO_ISSUER_URI = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yi2mx8XVs"
$env:COGNITO_CLIENT_ID = "5ct1362lebamr1fpmotcofinl6"
.\mvnw.cmd spring-boot:run

# Terminal 4 — frontend (:3000)
cd cleanfresh-frontend
npm start
```

Usuarios de prueba: uno por rol (Admin, Operador, Cliente), dados de
alta en el User Pool de Cognito como grupos con esos mismos nombres —
ver `CLAUDE.md` para el detalle de configuración.

---

## Indicador 1 — Login / Cognito (60%)

### 1. Login y logout funcionando

1. Abrir `http://localhost:3000` sin sesión iniciada (o en una ventana
   de incógnito).
2. **Se espera:** pantalla de login de la app (no el dashboard).
3. Click en "Iniciar sesión" → redirige al Hosted UI de Cognito
   (`...amazoncognito.com`) → loguearse con cualquiera de los 3
   usuarios de prueba.
4. **Se espera:** vuelve a `localhost:3000` ya autenticado, mostrando
   el dashboard correspondiente al rol.
5. Click en "Salir" (navbar, arriba a la derecha).
6. **Se espera:** vuelve a la pantalla de login (Cognito también cierra
   la sesión de su lado, no solo el navegador local).

### 2. Guards operando sin fallas

1. Logueado como Operador (o Cliente), presionar F5 varias veces
   seguidas.
2. **Se espera:** en ningún refresh aparece la vista de Admin ni queda
   la pantalla en blanco — siempre termina en la vista del rol
   correcto.
3. Sin sesión iniciada, intentar entrar directo a `localhost:3000`.
4. **Se espera:** siempre pantalla de login, nunca el dashboard.

### 3. Interceptor adjuntando el token en cada llamada

1. F12 → pestaña **Network** → filtrar por `8080`.
2. Recargar la página logueado (cualquier rol).
3. **Se espera:** cada request a `localhost:8080/api/...` (health,
   catalog, orders) tiene el header `Authorization: Bearer eyJ...`.
4. Click en cualquiera de esos requests → pestaña "Headers" → mostrar
   el header en vivo.

### 4. Tokens para consumir el API Gateway (el BFF)

1. Mismo Network tab del paso anterior: confirmar que las respuestas
   son `200 OK`, no `401`.
2. Opcional: copiar el valor del token (es el **access token**, no el
   idToken — con Cognito sí hay un scope de API propio) y pegarlo en
   [jwt.io](https://jwt.io) para mostrar el payload decodificado (sin
   validar la firma ahí, solo para leer los claims).

### 5. Roles y scopes leídos desde los claims

1. Loguearse con cada uno de los 3 usuarios de prueba, uno a la vez
   (cerrando sesión entre cada uno).
2. **Se espera:** cada uno ve su vista correspondiente (Admin /
   Operador / Cliente) y su badge de rol correcto en el navbar.
3. Para verlo "crudo": F12 → **Application** → Local Storage → buscar
   la entrada `oidc.user:...` (la guarda `oidc-client-ts`) →
   decodificar el `id_token` de adentro en jwt.io → mostrar el claim
   `cognito:groups`.
4. El **scope** se ve decodificando el **access_token** (no el
   idToken) de la misma entrada: tiene un claim `scope` con la lista
   separada por espacios, incluyendo
   `https://api.cleanfresh.com/access_as_user`. Ese mismo claim lo
   valida el BFF del lado servidor (ver Indicador 2, punto 1) — no es
   solo algo que se pide al loguearse y se ignora después.

---

## Indicador 2 — BFF (40%)

Todo esto se prueba con `curl`, sin necesidad del frontend — es la
forma más directa de comprobarlo sin depender de la UI.

### 1. Validación de issuer / tipo de token / client / scope / firma / vigencia

```bash
# Sin token -> 401
curl -i http://localhost:8080/api/orders

# Token invalido (firma no verifica) -> 401
curl -i http://localhost:8080/api/orders -H "Authorization: Bearer esto.no.es.un.jwt"
```

**Se espera:** `401 Unauthorized` en ambos casos. La validación de
issuer/firma/vigencia la hace Spring de forma automática a partir de
`issuer-uri` en `application.yaml` del BFF. Como los access tokens de
Cognito no tienen claim `aud` (a diferencia de Azure), se agregó un
validador propio (`CognitoTokenValidator`, en `SecurityConfig.java`)
que verifica tres cosas más allá de lo automático:

- `token_use == "access"` (rechaza un idToken colado en vez del access
  token que corresponde).
- `client_id` == el de esta app (equivalente funcional a validar
  "audience", que Cognito no expone como claim tradicional).
- `scope` contiene `https://api.cleanfresh.com/access_as_user` (si
  falta, responde `401` con `error="insufficient_scope"` — confirma
  que el scope no es solo algo que se pide al loguearse, se revisa de
  verdad en cada request).

### 2. Autorización por rol

Con un token real de **Cliente** (sacado del Network tab del frontend,
logueado como Cliente — el access token, no el idToken):

```bash
curl -i http://localhost:8080/api/orders/estado/CREADO \
  -H "Authorization: Bearer <access_token de Cliente>"
```

**Se espera:** `403 Forbidden` — ese endpoint tiene
`@PreAuthorize("hasAnyRole('Admin', 'Operador')")`, Cliente no tiene
permiso.

Con el mismo token contra un endpoint que sí le corresponde:

```bash
curl -i http://localhost:8080/api/orders \
  -H "Authorization: Bearer <access_token de Cliente>"
```

**Se espera:** `200 OK`.

### 3. Códigos 401 / 403 correctos

Resumen de la diferencia, ya demostrada arriba:

- **401** = no autenticado (sin token, token inválido/vencido, o del
  tipo/app equivocados).
- **403** = autenticado pero sin permiso para ese endpoint (rol
  incorrecto).

---

## Evidencia de conexión real a los microservicios (extra)

Para mostrar que no es todo mock/hardcodeado:

1. Loguearse como **Cliente**, ir a "Catálogo de servicios", click en
   "Solicitar" en cualquier servicio, elegir una sucursal, confirmar.
2. **Se espera:** el pedido aparece de inmediato en "Tus pedidos"
   (Cliente).
3. En **otra** ventana/perfil de navegador, loguearse como
   **Operador**, ir a "Gestión de órdenes", click en "Actualizar".
4. **Se espera:** el pedido creado por Cliente aparece ahí — prueba de
   que quedó persistido en `ms-cleanfresh-orders` de verdad (POST real,
   no solo estado local de React) y que dos sesiones distintas ven el
   mismo backend.

## Recomendación para la demo en vivo

Lo más convincente es abrir las devtools en Network **antes** de
loguearse, dejarlo filtrado por `8080`, y hacer el login en vivo: se ve
el token viajando en cada llamada y el `200`/`403` según corresponda.
Combinado con 2-3 `curl` sin token mostrando el `401`, cubre los dos
indicadores completos sin depender de que la UI "se vea bien".

## Antes de la demo: qué ya se probó en vivo y qué falta

La migración de MSAL a Cognito (Spec 026) se probó en un navegador real
y se corrigieron 3 problemas que solo aparecían con login real: typo en
`.env`, el jar del BFF corriendo desactualizado (seguía validando
contra Azure), y un mismatch `username`/email que hacía que los
pedidos del Cliente no aparecieran en "Tus pedidos" (Fix 027, que
también agregó la validación de `scope`). Con eso:

- ✅ Login/logout, interceptor, y creación real de pedidos (Cliente) —
  confirmados en vivo.
- ✅ 401 (sin token / token con firma inválida) — confirmado en vivo
  varias veces.
- ✅ Validación de scope — confirmado en vivo ("todo bien" tras
  reiniciar el BFF con `CognitoTokenValidator` chequeando `scope`).

**Todavía sin confirmar en vivo:**

- Las cuentas de Admin y Operador (solo se probó con Cliente en esta
  sesión — el código es el mismo, pero no hay evidencia fresca de
  las 3).
- Un 403 real (rol insuficiente) contra un token de Cognito — la
  sección "Autorización por rol" de arriba explica cómo probarlo.
- El mapeo `SUCURSAL_POR_OPERADOR` en `OrderService.java` (BFF) sigue
  con el valor viejo de Azure (`operador@cleanfreshchain.onmicrosoft.com`);
  con Cognito debería ser el `username` real del Operador de prueba
  (un valor tipo UUID, no un email) — sin ajustar esto, el filtro por
  sucursal del Operador probablemente no funcione.
