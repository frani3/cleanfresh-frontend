---
id: 013
type: spec
status: verified
---

# Spec 013 — Interceptor de axios + AuthGuard explícito

## Qué debe hacer

Hoy `apiService.js` arma el header `Authorization` a mano dentro de
`callBffApi()`, y cada componente que llama al BFF tiene que pasarle
`instance` y `account` explícitamente. Funciona, pero no es un
"interceptor" en el sentido que usa la pauta (equivalente al
`MsalInterceptor` de `msal-angular`, que no existe en `msal-react`).

Pasa a usarse un **interceptor real de axios**
(`apiClient.interceptors.request.use`) que agrega el token a **toda**
petición saliente automáticamente, sin que cada componente tenga que
pasar `instance`/`account` — el interceptor resuelve la cuenta activa
internamente.

Además, `App.jsx` pasa a usar un componente `AuthGuard` explícito (en vez
de un `if` suelto) que protege el contenido autenticado, mostrando
`Login` si no hay sesión.

## Acceptance Criteria

1. `apiService.js` registra un interceptor de request en el cliente de
   axios que agrega `Authorization: Bearer <idToken>` a toda petición,
   sin que las funciones exportadas (`getHealth`, futuras `getOrders`/
   `getCatalog`) reciban `instance`/`account` como parámetro.
2. Existe una función `configureApiAuth(msalInstance)` que se llama una
   sola vez, en `index.js`, justo después de crear el `PublicClientApplication`.
3. El interceptor usa `msalInstance.getActiveAccount()` para resolver la
   cuenta y `acquireTokenSilent`; si hace falta interacción
   (`InteractionRequiredAuthError`), cae a `acquireTokenPopup` — mismo
   comportamiento que tenía `apiService.js` antes, solo que ahora vive en
   el interceptor.
4. Si se llama a una función de `apiService.js` antes de
   `configureApiAuth()`, o sin cuenta activa, se lanza un error claro (no
   una petición sin token silenciosa).
5. `BentoDashboard.jsx` deja de pasar `instance`/`account` a `getHealth()`
   (y a las futuras `getOrders`/`getCatalog`).
6. Existe `src/components/AuthGuard.jsx`, que envuelve el contenido
   autenticado y muestra `Login` si `useIsAuthenticated()` es `false` —
   mismo comportamiento que el `if (!isAuthenticated) return <Login/>`
   que reemplaza.
7. `App.jsx` usa `<AuthGuard>` para envolver `<Navbar/>` + `<BentoDashboard/>`.
8. El comportamiento visible de la app no cambia: login, logout, la
   llamada real a `/api/health` y todo el resto de las specs anteriores
   siguen funcionando igual.
