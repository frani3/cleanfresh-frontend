---
id: 014
type: fix
status: verified
---

# Fix 014 — Interceptor sin fallback de cuenta activa

## Qué estaba mal

El interceptor de axios agregado en la Spec 013 resuelve la cuenta con
`msalInstance.getActiveAccount()` únicamente. Como ya vimos varias veces
en este proyecto (Fix del F5, Sidebar, Navbar), `getActiveAccount()`
devuelve `null` hasta que `setActiveAccount()` termina de correr — y esa
llamada vive en un flujo async separado (`index.js`, evento
`LOGIN_SUCCESS`), que puede no haber terminado todavía cuando
`BentoDashboard.jsx` ya resolvió su propia cuenta (usando el fallback
`accounts[0]`) y dispara la llamada a `getHealth()`.

Resultado: "Estado del sistema" muestra "Sin conexión" con el error
`apiService: no hay una cuenta activa para autenticar la petición.`
apenas se loguea, aunque la sesión esté perfectamente iniciada.

## Comportamiento correcto esperado

El interceptor usa el mismo patrón robusto que ya usan `Navbar.jsx` y
`BentoDashboard.jsx`: si `getActiveAccount()` no tiene nada, cae a la
primera cuenta de `getAllAccounts()`.

## Acceptance Criteria

1. El interceptor resuelve la cuenta con
   `msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]`.
2. Con sesión iniciada, "Estado del sistema" muestra "Online · :8080" y
   una latencia real (no "Sin conexión") apenas carga el panel Admin,
   sin necesidad de recargar la página.
3. El error `apiService: no hay una cuenta activa...` solo se lanza si
   de verdad no hay ninguna cuenta en caché (por ejemplo, sin sesión
   iniciada) — no por una condición de carrera.
4. El resto de la Spec 013 (AC1 a AC7) sigue cumpliéndose sin cambios.
