---
id: 026
type: spec
status: verified
---

# Spec 026 — Migración de MSAL/Azure a AWS Cognito (frontend + BFF)

## Qué debe hacer

El requisito de la pauta de EP1 cambió de MSAL/Azure Entra External ID
a AWS Cognito. Esto reemplaza el proveedor de identidad de punta a
punta:

**a) Frontend:** `@azure/msal-browser`/`@azure/msal-react` se
reemplazan por `oidc-client-ts`/`react-oidc-context`. Login/logout,
guards, lectura de roles y el interceptor de axios pasan a usar
Cognito en vez de Azure CIAM.

**b) BFF:** el issuer de validación pasa a ser el User Pool de
Cognito. Como los access tokens de Cognito no tienen claim `aud` (a
diferencia de Azure), se agrega un validador custom
(`CognitoTokenValidator`) que reemplaza esa verificación chequeando
`token_use` y `client_id`. Los roles pasan a leerse del claim
`cognito:groups` en vez de `roles`.

**c) `ms-cleanfresh-orders`/`ms-cleanfresh-catalog`:** sin cambios —
nunca validaron JWT, solo el BFF les habla.

## Decisiones técnicas / desvíos del pedido original

- **access_token en vez de idToken:** con Azure CIAM se usaba el
  idToken porque el tenant no soportaba scopes de API custom. Cognito
  sí tiene un scope propio (`.../access_as_user`), así que el BFF
  valida el **access_token** — es el patrón correcto para Cognito.
- **Los claims de identidad cambian:** el access token de Cognito NO
  trae `name`/`email`/`preferred_username` (esos son del idToken) —
  solo `username`. Todo lo que en el BFF leía `preferred_username`
  (mapeo operador→sucursal de la Spec 016, autor de un pedido nuevo de
  la Spec 025) pasa a leer `username`.
- **`UserManager` compartido en vez de `configureApiAuth`:**
  `apiService.js` no es un componente y no puede usar el hook
  `useAuth()`. En vez de una función `configureApiAuth(instance)`
  llamada desde `index.js` (patrón MSAL), se exporta un único
  `UserManager` de `oidc-client-ts` desde `authConfig.js`, usado tanto
  por el `AuthProvider` (React) como por `apiService.js` (plano) —
  mismo problema, solución más directa.
- **`redirect.html` no desaparece:** Cognito ya tiene registrado
  `/redirect.html` como callback URL del App Client (cambiarlo
  implica reconfigurar Cognito). Como esa ruta es un archivo estático
  fuera del bundle de React, no hay dónde montar el `AuthProvider` ahí
  — el archivo ahora solo rebota a `/` conservando `?code=&state=`, y
  el login se procesa en la app real.
- **`CognitoTokenValidator` (BFF, nuevo):** Spring's `audiences` no
  aplica sin claim `aud`. Este validador verifica `token_use ==
  "access"` (para que no llegue un idToken) y `client_id` (para que no
  llegue un token válido de otra app del mismo User Pool).

## Acceptance Criteria

1. `@azure/msal-browser`/`@azure/msal-react` desinstalados;
   `oidc-client-ts`/`react-oidc-context` instalados.
2. `src/authConfig.js` configura Cognito (authority, client_id,
   redirect_uri, scope, logout) y expone un `UserManager` compartido.
3. `src/index.js` usa `AuthProvider` de `react-oidc-context` en vez de
   `MsalProvider`.
4. Login (`auth.signinRedirect()`) y logout (`auth.removeUser()` +
   redirect manual al endpoint `/logout` del Hosted UI) funcionan sin
   referencias a MSAL.
5. Los roles se leen de `auth.user?.profile?.["cognito:groups"]`; el
   nombre/email de `auth.user?.profile?.name`/`email`.
6. `apiService.js` adjunta `access_token` (no idToken) en cada
   petición al BFF.
7. `public/redirect.html` no depende de `@azure/msal-browser` y
   procesa el callback de Cognito.
8. `npm run build` y `eslint` sin errores.
9. El BFF valida el JWT contra el issuer de Cognito, con `client_id`
   verificado por `CognitoTokenValidator` en vez de `audiences`.
10. Los roles en el BFF se extraen de `cognito:groups`.
11. Los 3 microservicios Java compilan sin errores.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | `npm uninstall`/`npm install` corridos; `package.json` sin rastro de `@azure/*` | ✅ Cumple |
| 2 | `authConfig.js` reescrito con `cognitoAuthConfig` + `userManager` | ✅ Cumple |
| 3 | `index.js` con `<AuthProvider userManager={userManager}>` | ✅ Cumple |
| 4 | `AuthGuard.jsx`/`Navbar.jsx` reescritos con `useAuth()`, sin imports de MSAL | ✅ Cumple |
| 5 | `BentoDashboard.jsx`: `roles`/`actor` leídos de `auth.user.profile` | ✅ Cumple |
| 6 | `apiService.js`: interceptor usa `user.access_token` | ✅ Cumple |
| 7 | `redirect.html` reescrito, sin script de MSAL ni referencia al bundle vendorizado (se borró `scripts/copy-redirect-bridge.js` y el `postinstall`) | ✅ Cumple |
| 8 | `eslint` sin salida; `npm run build` → "Compiled successfully" (bundle ~43KB más chico sin MSAL) | ✅ Cumple |
| 9 | `SecurityConfig.java`: `JwtDecoder` custom con `CognitoTokenValidator`; `application.yaml` sin `audiences`, con `cognito.client-id` | ✅ Cumple |
| 10 | `JwtGrantedAuthoritiesConverter.setAuthoritiesClaimName("cognito:groups")` | ✅ Cumple |
| 11 | `mvnw compile` sin errores en `ms-cleanfresh-bff`, `ms-cleanfresh-orders`, `ms-cleanfresh-catalog` | ✅ Cumple |

## Verificación en vivo (actualización — ver Fix 027)

Lo de abajo se escribió cuando esto no se había probado todavía contra
el Cognito real. Ya se probó en vivo y se encontraron/corrigieron 3
problemas reales (ver Fix 027): typo en `.env`, jar del BFF
desactualizado, y mismatch `username`/email en el filtro de "Tus
pedidos". Con esos fixes, el login, el interceptor, y la creación de
pedidos por Cliente funcionan de punta a punta. Sigue sin confirmarse
en vivo con las cuentas de Admin y Operador específicamente (solo se
verificó con Cliente).

**Pendiente sin resolver:** el mapeo `SUCURSAL_POR_OPERADOR` en
`OrderService.java` (BFF) sigue con el valor viejo de Azure
(`operador@cleanfreshchain.onmicrosoft.com`) — con Cognito ese mapeo
debería usar el `username` real del Operador de prueba (un valor tipo
UUID, como se vio con Cliente), y hoy casi seguro no coincide.
