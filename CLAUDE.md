# Clean&Fresh Manager — Contexto del Proyecto

## Descripción General

Sistema de gestión para una cadena de lavanderías llamada **Clean&Fresh**, desarrollado como caso adaptado del caso semestral Pedidos360 para la asignatura **DSY1107 Cloud Native 1** de DuocUC. Trabajo individual, **Evaluación Parcial N°1 (EP1)**.

---

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | React (Create React App, **NO Vite**), JavaScript |
| Autenticación Frontend | `oidc-client-ts` + `react-oidc-context` |
| BFF | Spring Boot 4.1.1, Java 21, Maven |
| Microservicios | Spring Boot 4.1.1, Java 21, Maven |
| IDaaS | AWS Cognito (User Pool) |
| JDK local | Java 21 en `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot` |

> **Historial:** el proyecto arrancó con MSAL + Azure Entra External ID
> (CIAM); se migró a AWS Cognito porque cambió el requisito de la
> pauta. La lógica de roles/guards/interceptor es equivalente, cambian
> el proveedor y algunos nombres de claim (ver más abajo).

---

## AWS Cognito — User Pool

| Dato | Valor |
|---|---|
| Authority (issuer) | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yi2mx8XVs` |
| Client ID | `5ct1362lebamr1fpmotcofinl6` |
| Dominio (Hosted UI) | `https://us-east-1yi2mx8xvs.auth.us-east-1.amazoncognito.com` |
| Redirect URI | `http://localhost:3000/redirect.html` |
| Logout URI | `http://localhost:3000` |
| Scope | `openid email profile https://api.cleanfresh.com/access_as_user` |

### Usuarios de prueba

Uno por rol (Admin, Operador, Cliente), como grupos del User Pool
(`cognito:groups`) — mismos nombres de rol que antes. Las credenciales
puntuales no quedaron documentadas acá; confirmarlas contra el User
Pool de Cognito si hace falta recrearlas.

---

## Repositorios GitHub (usuario: frani3)

| Proyecto | URL |
|---|---|
| Frontend | https://github.com/frani3/Clean-Fresh |
| BFF | https://github.com/frani3/ms-cleanfresh-bff |
| MS Orders | https://github.com/frani3/ms-cleanfresh-orders |
| MS Catalog | https://github.com/frani3/ms-cleanfresh-catalog |

---

## Puertos Locales

| Servicio | Puerto |
|---|---|
| Frontend | http://localhost:3000 |
| BFF | http://localhost:8080 |
| ms-cleanfresh-orders | http://localhost:8081 |
| ms-cleanfresh-catalog | http://localhost:8082 |

---

## Variables de Entorno

### Frontend (`.env` en raíz del proyecto)
```
REACT_APP_COGNITO_AUTHORITY=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yi2mx8XVs
REACT_APP_COGNITO_CLIENT_ID=5ct1362lebamr1fpmotcofinl6
REACT_APP_COGNITO_DOMAIN=https://us-east-1yi2mx8xvs.auth.us-east-1.amazoncognito.com
REACT_APP_API_SCOPE=https://api.cleanfresh.com/access_as_user
```

### BFF (variables de entorno del proceso, no `.env`)
```
COGNITO_ISSUER_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yi2mx8XVs
COGNITO_CLIENT_ID=5ct1362lebamr1fpmotcofinl6
```

---

## Configuración Frontend (`src/authConfig.js`)

```javascript
import { UserManager } from "oidc-client-ts";

export const cognitoAuthConfig = {
  authority: process.env.REACT_APP_COGNITO_AUTHORITY,
  client_id: process.env.REACT_APP_COGNITO_CLIENT_ID,
  redirect_uri: `${window.location.origin}/redirect.html`,
  response_type: "code",
  scope: `openid email profile ${process.env.REACT_APP_API_SCOPE}`,
  post_logout_redirect_uri: window.location.origin,
  loadUserInfo: true,
};

export const cognitoDomain = process.env.REACT_APP_COGNITO_DOMAIN;

// Compartida entre el AuthProvider (index.js) y apiService.js (que no
// es un componente y no puede usar el hook useAuth()).
export const userManager = new UserManager(cognitoAuthConfig);
```

> **IMPORTANTE:** el BFF recibe el **access_token** (no el idToken) —
> al revés que con Azure CIAM. Acá sí hay un scope de API custom
> (`https://api.cleanfresh.com/access_as_user`), así que el access
> token es el que corresponde para autorizar llamadas al BFF.
> `apiService.js` usa `user.access_token`.
>
> **Ojo con los claims:** el access token de Cognito **no** trae
> `name`/`email`/`preferred_username` (esos son del idToken) — el
> único identificador de la persona ahí es `username`. El BFF lo usa en
> vez de `preferred_username` (ver `OrderService.java`).

`public/redirect.html` está registrado en Cognito como callback URL de
la app. En vez de duplicar la lógica de `oidc-client-ts` en HTML
estático suelto, ese archivo solo rebota a `/` conservando
`?code=&state=`, y ahí el `AuthProvider` (montado en la app real)
procesa el login normalmente.

---

## Configuración BFF (`src/main/resources/application.yaml`)

```yaml
server:
  port: 8080

spring:
  application:
    name: ms-cleanfresh-bff
  security:
    oauth2:
      resourceserver:
        jwt:
          # Los access tokens de Cognito no traen claim "aud" (a diferencia
          # de Azure) — no se usa "audiences" acá, esa validación la hace
          # CognitoTokenValidator contra "client_id" (ver SecurityConfig).
          issuer-uri: ${COGNITO_ISSUER_URI}

management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never

cognito:
  client-id: ${COGNITO_CLIENT_ID}

microservices:
  orders:
    base-url: http://localhost:8081
  catalog:
    base-url: http://localhost:8082
```

---

## Estructura del BFF (`ms-cleanfresh-bff`)

```
src/main/java/com/cleanfresh/ms_cleanfresh_bff/
├── config/
│   └── SecurityConfig.java        # JWT validation, CORS, stateless, @EnableMethodSecurity
├── controller/
│   ├── HealthController.java      # GET /api/health — público
│   ├── OrderController.java       # GET /api/orders, /api/orders/{id}, /api/orders/estado/{estado}
│   └── CatalogController.java     # GET /api/catalog, /api/catalog/{id}, /api/catalog/disponibles
├── service/
│   ├── OrderService.java
│   └── CatalogService.java
├── repository/
│   ├── OrderRepository.java       # RestClient → ms-cleanfresh-orders:8081
│   └── CatalogRepository.java     # RestClient → ms-cleanfresh-catalog:8082
└── dto/
    ├── OrderResponse.java
    └── ServiceResponse.java
```

### Roles y autorización en el BFF

- Los roles vienen en el claim `cognito:groups` del JWT (grupos del User Pool), con prefijo `ROLE_`
- `SecurityConfig` extrae roles con `JwtGrantedAuthoritiesConverter` usando `setAuthoritiesClaimName("cognito:groups")`
- Los controllers usan `@PreAuthorize("hasAnyRole('Admin','Operador','Cliente')")` según corresponda
- `CognitoTokenValidator` (en `config/`) reemplaza la validación de `audiences` de Azure: chequea `token_use == "access"` y `client_id` contra el de esta app, sobre el `JwtDecoder` custom que registra `SecurityConfig`

---

## Estructura del Frontend (`cleanfresh-frontend`)

```
src/
├── authConfig.js                  # Configuración Cognito + UserManager compartido
├── index.js                       # AuthProvider (react-oidc-context) wrapping App
├── App.jsx                        # AuthGuard -> Navbar + BentoDashboard
├── App.css                        # Estilos globales + bento grid
├── components/
│   ├── AuthGuard.jsx               # Pantalla de login / protección de la app
│   └── Navbar.jsx                  # Logo, nombre usuario, rol, botón logout
├── pages/
│   └── BentoDashboard.jsx         # Dashboard bento único con tarjetas por rol
└── services/
    └── apiService.js              # Llamadas al BFF con access_token como Bearer
```

### Diseño actual

El frontend usa un **diseño bento grid** en una sola página. No hay React Router ni sidebar. Según el rol del usuario se muestran diferentes tarjetas:

| Rol | Tarjetas visibles |
|---|---|
| Admin | Estado BFF, KPIs, Órdenes recientes, Catálogo, Reportería por sucursal, Auditoría |
| Operador | KPIs operacionales, Órdenes, Catálogo |
| Cliente | Mis órdenes, Catálogo con botón solicitar, Puntos de fidelidad |

### Lectura de roles

Con `react-oidc-context`, `auth.user` ya refleja el resultado completo
del login/silent renew procesado por `oidc-client-ts` — no hace falta
el workaround que sí necesitaba MSAL (forzar `acquireTokenSilent` tras
cada F5 porque la cuenta cacheada podía traer claims incompletos). Se
lee directo:

```javascript
const auth = useAuth();
const roles = auth.user?.profile?.["cognito:groups"] || [];
const isAdmin = roles.includes("Admin");
```

---

## Módulos del Sistema

### Servicios de lavandería (catálogo)
- Lavado y secado — $18.000
- Lavado en seco — $25.000
- Planchado — $9.500
- Lavado de edredones — $32.000
- Servicio exprés — $12.000

### Estados de órdenes
`CREADO → ACEPTADO → EN_PREPARACION → DESPACHADO → ENTREGADO / CANCELADO`

---

## Comandos para levantar el entorno local

```powershell
# Configurar Java 21 (requerido en TODAS las terminales Java)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Terminal 1 — ms-cleanfresh-orders (puerto 8081)
cd C:\Users\franc\ms-cleanfresh-orders
java -jar target/ms-cleanfresh-orders-0.0.1-SNAPSHOT.jar

# Terminal 2 — ms-cleanfresh-catalog (puerto 8082)
cd C:\Users\franc\ms-cleanfresh-catalog
java -jar target/ms-cleanfresh-catalog-0.0.1-SNAPSHOT.jar

# Terminal 3 — BFF (puerto 8080)
cd C:\Users\franc\ms-cleanfresh-bff
$env:COGNITO_ISSUER_URI="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yi2mx8XVs"
$env:COGNITO_CLIENT_ID="5ct1362lebamr1fpmotcofinl6"
java -jar target/ms-cleanfresh-bff-0.0.1-SNAPSHOT.jar

# Terminal 4 — Frontend (puerto 3000)
cd C:\Users\franc\cleanfresh-frontend
npm start

# Si necesitas recompilar algún proyecto Java (Windows):
.\mvnw.cmd clean package -DskipTests
```

---

## Requisitos EP1 — Pauta de Evaluación

> Los títulos de los indicadores ("MSAL"/"BFF") quedaron como los dio
> el profesor originalmente; el mecanismo de auth detrás cambió de
> MSAL/Azure a `react-oidc-context`/Cognito, pero lo que evalúa cada
> punto (login real con IDaaS, roles desde el token, JWT validado en
> el BFF) es lo mismo.

### Indicador 1 — MSAL (60%)

Para nota máxima se requiere:
- ✅ Login y logout funcionando correctamente
- ✅ Token adjuntado en todas las llamadas al backend
- ✅ Roles y scopes leídos correctamente desde los claims del token
- ✅ Guards/protección de vistas según rol
- ✅ Tokens obtenidos para consumir el API Gateway

### Indicador 2 — BFF (40%)

Para nota máxima se requiere:
- ✅ Validar issuer del token correctamente
- ✅ Validar audience del token
- ✅ Verificar firma y vigencia del token
- ✅ Aplicar autorización por rol en los endpoints (`@PreAuthorize`)
- ✅ Responder con códigos de error adecuados (401, 403)

### Requisitos adicionales del profesor (instrucciones específicas EP1)

- ✅ El código del frontend debe estar completo, modular, sin errores de compilación y con vistas funcionales
- ✅ El código de todos los componentes del backend debe compilar, seguir buenas prácticas y responder a pruebas básicas
- ✅ El backend debe corresponder a **varios microservicios** construidos en Java con Spring Boot
- ✅ El frontend debe implementar el flujo de login con IDaaS y utilizar el JWT en las llamadas al backend
- ✅ El backend debe incluir filtros que validen el JWT recibido desde el IDaaS
- ⚠️ La integración del backend con **base de datos cloud** debe estar configurada correctamente mediante entidades, repositorios y propiedades de conexión (**PENDIENTE**)
- ✅ Los archivos `.gitignore` deben estar correctamente configurados para no subir `.env` ni `node_modules`
- ✅ Entrega mediante enlaces de repositorios GitHub a AVA y correo del docente

---

## Arquitectura del Sistema (EP1)

```
Frontend React (localhost:3000)
        |
        | access_token (Bearer)
        v
BFF Spring Boot (localhost:8080)
        |
        |-- valida JWT contra el User Pool de Cognito
        |-- extrae rol del claim "cognito:groups"
        |-- valida token_use=access y client_id (CognitoTokenValidator)
        |-- aplica @PreAuthorize por rol
        |
        |-- RestClient --> ms-cleanfresh-orders (localhost:8081)
        |-- RestClient --> ms-cleanfresh-catalog (localhost:8082)
        |
AWS Cognito (User Pool, Hosted UI)
        |
        |-- emite access_token con claims "cognito:groups", "client_id", "token_use", "username"
        |-- issuer: https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yi2mx8XVs
```

---

## Decisiones técnicas importantes

1. **access_token como Bearer:** a diferencia de Azure CIAM (que no soportaba scopes de API custom, por eso se usaba el idToken), acá sí hay un scope propio (`https://api.cleanfresh.com/access_as_user`), así que el BFF valida el **access_token**. `apiService.js` usa `user.access_token` en vez de `result.idToken`.

2. **Sin claim `aud` en el access token:** Cognito no lo incluye (a diferencia de Azure). El BFF reemplaza esa validación con `CognitoTokenValidator`, que chequea `token_use == "access"` y `client_id` contra el de esta app.

3. **Roles en el token:** los roles llegan como grupos del User Pool, en el claim `cognito:groups`. El BFF los extrae con `JwtGrantedAuthoritiesConverter` y los prefija con `ROLE_` (ej: `ROLE_Admin`).

4. **Identidad limitada en el access token:** el access token no trae `name`/`email`/`preferred_username` (son del idToken) — solo `username`. El BFF usa ese claim donde antes usaba `preferred_username` (mapeo operador→sucursal, autor de un pedido nuevo).

5. **`onSigninCallback` en vez de manejo manual de cuenta activa:** `oidc-client-ts` no tiene el problema de caché que tenía MSAL (cuenta reconstruida con claims incompletos tras F5) — no hace falta el workaround de forzar `acquireTokenSilent` que sí era necesario antes.

6. **Diseño bento grid:** Se eliminó el sidebar y React Router. Toda la interfaz está en un solo `BentoDashboard.jsx` con tarjetas bento según rol.

---

## Documentación de cambios del frontend (`specs/`)

Los cambios funcionales del panel Admin (CRUD de catálogo, CRUD de
órdenes, modales, filtros, correcciones) se documentan con metodología
Spec-Driven Development manual en [`specs/README.md`](specs/README.md):
cada ítem tiene su spec o fix con Acceptance Criteria, numerados de forma
única (001, 002, ...) sin importar el tipo. Ver ese índice antes de tocar
el panel Admin, para no duplicar algo ya resuelto ahí.

---

## Pendientes

- [ ] Conectar microservicios a **base de datos cloud** (Oracle o PostgreSQL) con entidades JPA y repositorios Spring Data
- [x] Migración a Cognito probada en vivo (Fix 027) — login, interceptor y creación de pedidos por Cliente confirmados funcionando; se corrigieron 3 problemas reales en el proceso (typo de `.env`, jar del BFF desactualizado, mismatch `username`/email en "Tus pedidos") y se agregó validación de `scope` en `CognitoTokenValidator`
- [ ] El mapa `SUCURSAL_POR_OPERADOR` en `OrderService.java` (BFF) sigue con el valor viejo de Azure (`operador@cleanfreshchain.onmicrosoft.com`) — con Cognito debería usar el `username` real del Operador de prueba (un valor tipo UUID, no un email); no confirmado en vivo con esa cuenta todavía
- [ ] Confirmar que los grupos de Cognito se llaman exactamente `Admin`/`Operador`/`Cliente` con las cuentas de Admin y Operador (solo se confirmó con Cliente)
- [x] Corregir que al hacer F5 con rol Admin/Operador no muestre vista de Cliente — ya no aplica el workaround original de MSAL; `react-oidc-context` no tiene ese problema de caché
- [x] Mejorar diseño bento: ajustar overflow de tabla de órdenes, max-height del JSON del BFF — resuelto (`overflow-x: auto` + columnas compactas en la tabla, `max-height: 300px` en el bloque de estado del BFF)
- [ ] Ver `specs/README.md` → "Pendiente de verificación visual" para los ítems de responsive que faltan probar en navegador
