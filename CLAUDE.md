# Clean&Fresh Manager — Contexto del Proyecto

## Descripción General

Sistema de gestión para una cadena de lavanderías llamada **Clean&Fresh**, desarrollado como caso adaptado del caso semestral Pedidos360 para la asignatura **DSY1107 Cloud Native 1** de DuocUC. Trabajo individual, **Evaluación Parcial N°1 (EP1)**.

---

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | React (Create React App, **NO Vite**), JavaScript |
| Autenticación Frontend | MSAL Browser 5 + MSAL React 5 |
| BFF | Spring Boot 4.1.1, Java 21, Maven |
| Microservicios | Spring Boot 4.1.1, Java 21, Maven |
| IDaaS | Microsoft Entra External ID (tenant CIAM) |
| JDK local | Java 21 en `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot` |

---

## Azure — Tenant CleanFreshChain (CIAM/External)

| Dato | Valor |
|---|---|
| Tenant ID | `ced0d159-4118-41be-b6a5-16f7a9a9298b` |
| Dominio | `CleanFreshChain.onmicrosoft.com` |
| Authority | `https://CleanFreshChain.ciamlogin.com/ced0d159-4118-41be-b6a5-16f7a9a9298b/v2.0` |
| App Registration Frontend | `cleanfresh-frontend` — Client ID: `4823b4a7-6749-4cd0-b83c-aa8b4db59d50` |
| App Registration API | `cleanfresh-api` — Client ID: `7d0eff7d-9e49-4e31-b76f-a8cb746ad2a9` |

### Usuarios de prueba

| Usuario | Email | Rol asignado |
|---|---|---|
| Admin | `Admin@CleanFreshChain.onmicrosoft.com` | Admin |
| Operador | `Operador@CleanFreshChain.onmicrosoft.com` | Operador |
| Cliente | `Cliente@CleanFreshChain.onmicrosoft.com` | Cliente |

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
REACT_APP_CLIENT_ID=4823b4a7-6749-4cd0-b83c-aa8b4db59d50
REACT_APP_TENANT_ID=ced0d159-4118-41be-b6a5-16f7a9a9298b
REACT_APP_API_CLIENT_ID=7d0eff7d-9e49-4e31-b76f-a8cb746ad2a9
```

### BFF (`.env` en raíz del proyecto)
```
AZURE_TENANT_ID=ced0d159-4118-41be-b6a5-16f7a9a9298b
AZURE_API_CLIENT_ID=7d0eff7d-9e49-4e31-b76f-a8cb746ad2a9
AZURE_FRONTEND_CLIENT_ID=4823b4a7-6749-4cd0-b83c-aa8b4db59d50
```

---

## Configuración MSAL Frontend (`src/authConfig.js`)

```javascript
export const msalConfig = {
    auth: {
        clientId: process.env.REACT_APP_CLIENT_ID,
        authority: `https://CleanFreshChain.ciamlogin.com/${process.env.REACT_APP_TENANT_ID}/v2.0`,
        knownAuthorities: [`CleanFreshChain.ciamlogin.com`],
        redirectUri: `${window.location.origin}/redirect.html`,
        postLogoutRedirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    }
};

export const loginRequest = {
    scopes: ["openid", "profile", "User.Read"]
};

export const protectedResources = {
    bffApi: {
        endpoint: "http://localhost:8080/api",
        scopes: ["User.Read"],
    },
};
```

> **IMPORTANTE:** El BFF recibe el **idToken** (no el accessToken) porque el tenant CIAM no soporta scopes de API personalizados. El `apiService.js` usa `result.idToken` en lugar de `result.accessToken`.

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
          issuer-uri: https://ced0d159-4118-41be-b6a5-16f7a9a9298b.ciamlogin.com/ced0d159-4118-41be-b6a5-16f7a9a9298b/v2.0
          audiences: ${AZURE_FRONTEND_CLIENT_ID}

management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never

azure:
  tenant-id: ${AZURE_TENANT_ID}
  client-id: ${AZURE_API_CLIENT_ID}

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

- Los roles vienen en el claim `roles` del JWT con prefijo `ROLE_`
- `SecurityConfig` extrae roles con `JwtGrantedAuthoritiesConverter` usando `setAuthoritiesClaimName("roles")`
- Los controllers usan `@PreAuthorize("hasAnyRole('Admin','Operador','Cliente')")` según corresponda

---

## Estructura del Frontend (`cleanfresh-frontend`)

```
src/
├── authConfig.js                  # Configuración MSAL
├── index.js                       # MsalProvider wrapping App
├── App.jsx                        # Login vs BentoDashboard según isAuthenticated
├── App.css                        # Estilos globales + bento grid
├── components/
│   └── Navbar.jsx                 # Logo, nombre usuario, rol, botón logout
├── pages/
│   └── BentoDashboard.jsx         # Dashboard bento único con tarjetas por rol
└── services/
    └── apiService.js              # Llamadas al BFF con idToken como Bearer
```

### Diseño actual

El frontend usa un **diseño bento grid** en una sola página. No hay React Router ni sidebar. Según el rol del usuario se muestran diferentes tarjetas:

| Rol | Tarjetas visibles |
|---|---|
| Admin | Estado BFF, KPIs, Órdenes recientes, Catálogo, Reportería por sucursal, Auditoría |
| Operador | KPIs operacionales, Órdenes, Catálogo |
| Cliente | Mis órdenes, Catálogo con botón solicitar, Puntos de fidelidad |

### Lectura de roles (patrón correcto con tenant CIAM)

`getActiveAccount()`/`accounts[0]` reconstruyen la cuenta leyendo el
caché de `localStorage` **sin volver a validar el token** — tras un F5
esto puede devolver `idTokenClaims` incompleto (sin `roles`), aunque
justo después del login sí venga completo. Por eso no alcanza con
esperar `inProgress === InteractionStatus.None`: hay que forzar
`acquireTokenSilent` para obtener una cuenta con los claims reales.

```javascript
const { instance, accounts, inProgress } = useMsal();

useEffect(() => {
  if (inProgress !== InteractionStatus.None) return;
  const activeAccount = instance.getActiveAccount() || accounts[0];
  if (!activeAccount) return;

  instance
    .acquireTokenSilent({ ...loginRequest, account: activeAccount })
    .then((result) => setRoles(result.account?.idTokenClaims?.roles || []))
    .catch((error) => {
      if (error instanceof InteractionRequiredAuthError) {
        instance.acquireTokenRedirect({ ...loginRequest, account: activeAccount });
      }
    });
}, [inProgress, instance, accounts]);
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
$env:AZURE_TENANT_ID="ced0d159-4118-41be-b6a5-16f7a9a9298b"
$env:AZURE_API_CLIENT_ID="7d0eff7d-9e49-4e31-b76f-a8cb746ad2a9"
$env:AZURE_FRONTEND_CLIENT_ID="4823b4a7-6749-4cd0-b83c-aa8b4db59d50"
java -jar target/ms-cleanfresh-bff-0.0.1-SNAPSHOT.jar

# Terminal 4 — Frontend (puerto 3000)
cd C:\Users\franc\cleanfresh-frontend
npm start

# Si necesitas recompilar algún proyecto Java (Windows):
.\mvnw.cmd clean package -DskipTests
```

---

## Requisitos EP1 — Pauta de Evaluación

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
        | idToken (Bearer)
        v
BFF Spring Boot (localhost:8080)
        |
        |-- valida JWT contra Azure CIAM
        |-- extrae rol del claim "roles"
        |-- aplica @PreAuthorize por rol
        |
        |-- RestClient --> ms-cleanfresh-orders (localhost:8081)
        |-- RestClient --> ms-cleanfresh-catalog (localhost:8082)
        |
Azure Entra External ID (CIAM)
        |
        |-- emite idToken con claim "roles"
        |-- issuer: https://ced0d159...ciamlogin.com/.../v2.0
        |-- audience: Client ID del frontend
```

---

## Decisiones técnicas importantes

1. **Tenant CIAM vs Workforce:** Se usa tenant External (CIAM) porque el tenant de DuocUC no da acceso a los estudiantes. Esto implica que el BFF valida el **idToken** en lugar del accessToken, porque el tenant CIAM no emite accessTokens con scopes de API personalizados.

2. **idToken como Bearer:** El `apiService.js` usa `result.idToken` en lugar de `result.accessToken`. El BFF valida con el audience del Client ID del frontend (`4823b4a7...`).

3. **Roles en el token:** Los roles llegan en el claim `roles` del idToken. El BFF los extrae con `JwtGrantedAuthoritiesConverter` y los prefija con `ROLE_` (ej: `ROLE_Admin`).

4. **cacheLocation localStorage:** Se usa `localStorage` en lugar de `sessionStorage` para que la sesión persista al hacer F5. Al recargar, no alcanza con esperar `inProgress === InteractionStatus.None`: hay que forzar `acquireTokenSilent` antes de leer los roles (ver sección "Lectura de roles" más abajo) porque la cuenta reconstruida solo desde caché puede traer `idTokenClaims` incompleto.

5. **Diseño bento grid:** Se eliminó el sidebar y React Router. Toda la interfaz está en un solo `BentoDashboard.jsx` con tarjetas bento según rol.

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
- [ ] Conectar páginas Orders y Catalog del frontend al BFF (actualmente usan datos mock)
- [x] Corregir que al hacer F5 con rol Admin/Operador no muestre vista de Cliente — resuelto forzando `acquireTokenSilent` al terminar de restaurar la sesión MSAL, en vez de confiar en la lectura síncrona de `getActiveAccount()`
- [x] Mejorar diseño bento: ajustar overflow de tabla de órdenes, max-height del JSON del BFF — resuelto (`overflow-x: auto` + columnas compactas en la tabla, `max-height: 300px` en el bloque de estado del BFF)
- [ ] Ver `specs/README.md` → "Pendiente de verificación visual" para los ítems de responsive que faltan probar en navegador
