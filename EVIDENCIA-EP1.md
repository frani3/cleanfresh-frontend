# Evidencia EP1 — Guía paso a paso para el profesor

Esta guía muestra, paso a paso, cómo comprobar los dos indicadores de
la pauta de EP1 (MSAL 60% + BFF 40%) sobre este proyecto. No requiere
leer el código para creerlo: cada punto tiene una acción concreta
(click, curl, F12) y qué se espera ver.

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
$env:AZURE_TENANT_ID = "..."
$env:AZURE_API_CLIENT_ID = "..."
.\mvnw.cmd spring-boot:run

# Terminal 4 — frontend (:3000)
cd cleanfresh-frontend
npm start
```

Usuarios de prueba (uno por rol, ver `CLAUDE.md` para las
credenciales): `Admin@CleanFreshChain.onmicrosoft.com`,
`Operador@CleanFreshChain.onmicrosoft.com`,
`Cliente@CleanFreshChain.onmicrosoft.com`.

---

## Indicador 1 — MSAL (60%)

### 1. Login y logout funcionando

1. Abrir `http://localhost:3000` sin sesión iniciada (o en una ventana
   de incógnito).
2. **Se espera:** pantalla de login de la app (no el dashboard).
3. Click en "Iniciar sesión con Microsoft" → redirige a
   `CleanFreshChain.ciamlogin.com` → loguearse con cualquiera de los 3
   usuarios de prueba.
4. **Se espera:** vuelve a `localhost:3000` ya autenticado, mostrando
   el dashboard correspondiente al rol.
5. Click en "Salir" (navbar, arriba a la derecha).
6. **Se espera:** vuelve a la pantalla de login.

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
2. Opcional: copiar el valor del token y pegarlo en
   [jwt.io](https://jwt.io) para mostrar el payload decodificado (sin
   validar la firma ahí, solo para leer los claims).

### 5. Roles y scopes leídos desde los claims

1. Loguearse con cada uno de los 3 usuarios de prueba, uno a la vez
   (cerrando sesión entre cada uno).
2. **Se espera:** cada uno ve su vista correspondiente (Admin /
   Operador / Cliente) y su badge de rol correcto en el navbar.
3. Para verlo "crudo": F12 → **Application** → Local Storage → buscar
   la entrada de MSAL con el idToken → decodificarlo (jwt.io) → mostrar
   el claim `roles`.

---

## Indicador 2 — BFF (40%)

Todo esto se prueba con `curl`, sin necesidad del frontend — es la
forma más directa de comprobarlo sin depender de la UI.

### 1. Validación de issuer / audience / firma / vigencia

```bash
# Sin token -> 401
curl -i http://localhost:8080/api/orders

# Token invalido (firma no verifica) -> 401
curl -i http://localhost:8080/api/orders -H "Authorization: Bearer esto.no.es.un.jwt"
```

**Se espera:** `401 Unauthorized` en ambos casos. Esta validación la
hace Spring de forma automática a partir de `issuer-uri` y `audiences`
en `application.yaml` del BFF (`oauth2ResourceServer.jwt()` en
`SecurityConfig.java`) — no hay código manual de validación, lo cual es
justamente lo que pide la pauta ("BFF valida issuer y audience de forma
correcta").

### 2. Autorización por rol

Con un token real de **Cliente** (sacado del Network tab del frontend,
logueado como Cliente):

```bash
curl -i http://localhost:8080/api/orders/estado/CREADO \
  -H "Authorization: Bearer <idToken de Cliente>"
```

**Se espera:** `403 Forbidden` — ese endpoint tiene
`@PreAuthorize("hasAnyRole('Admin', 'Operador')")`, Cliente no tiene
permiso.

Con el mismo token contra un endpoint que sí le corresponde:

```bash
curl -i http://localhost:8080/api/orders \
  -H "Authorization: Bearer <idToken de Cliente>"
```

**Se espera:** `200 OK`.

### 3. Códigos 401 / 403 correctos

Resumen de la diferencia, ya demostrada arriba:

- **401** = no autenticado (sin token o token inválido/vencido).
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
