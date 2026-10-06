# Clean&Fresh Manager — Frontend

Frontend en React (Create React App) del sistema de gestión de la
cadena de lavanderías Clean&Fresh. Proyecto individual para **EP1** de
**DSY1107 Cloud Native 1** (DuocUC).

Dashboard de una sola pantalla ("bento grid") que cambia de vista según
el rol leído del JWT (Admin / Operador / Cliente), autenticado contra
Azure Entra External ID (CIAM) con MSAL y conectado a un BFF en Spring
Boot que a su vez habla con dos microservicios (órdenes y catálogo).

## Stack

- React 18 (Create React App, JavaScript — sin TypeScript)
- MSAL Browser 5 / MSAL React 5
- Axios (con interceptor que adjunta el idToken en cada llamada)

## Requisitos

- Node.js 18+
- El BFF y los dos microservicios corriendo (ver sus propios README)

## Configuración

Crear un archivo `.env` en la raíz con:

```
REACT_APP_CLIENT_ID=<client id de la app registration del frontend>
REACT_APP_TENANT_ID=<tenant id de Azure Entra External ID>
REACT_APP_API_CLIENT_ID=<client id de la app registration del API/BFF>
```

Los valores reales están documentados en `CLAUDE.md` (no se suben acá
por ser un archivo de contexto de desarrollo, pero no contienen
secretos — son identificadores públicos de una app pública de MSAL).

## Levantar en local

```bash
npm install
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Necesita que el
BFF esté corriendo en `http://localhost:8080` (ver `authConfig.js` →
`protectedResources.bffApi.endpoint`).

## Usuarios de prueba

Tres cuentas de prueba en el tenant CIAM, una por rol (Admin, Operador,
Cliente) — ver `CLAUDE.md` para las credenciales.

## Scripts

- `npm start` — modo desarrollo
- `npm run build` — build de producción
- `npx eslint src --ext .js,.jsx` — lint

## Estructura

```
src/
├── authConfig.js          # Configuración MSAL
├── index.js                # MsalProvider + inicialización de la cuenta activa
├── App.jsx                 # AuthGuard + Navbar + BentoDashboard
├── components/
│   ├── AuthGuard.jsx        # Pantalla de login / protección de la app
│   └── Navbar.jsx           # Usuario, rol y logout
├── pages/
│   └── BentoDashboard.jsx  # Dashboard único, cambia de vista según el rol
└── services/
    └── apiService.js       # Cliente axios + interceptor de auth hacia el BFF
```

## Documentación por entrega

- [`EP1/`](EP1/): entrega 1 (cerrada) — specs/fixes 001–028, evidencia y
  explicaciones de Cognito/BFF.
- [`EP2/`](EP2/): entrega 2 (en curso) — arquitectura objetivo y
  documentación nueva.

Los cambios funcionales se documentan con una metodología manual de
Spec-Driven Development (índice en
[`EP1/specs/README.md`](EP1/specs/README.md)): cada funcionalidad nueva o
corrección tiene su spec/fix con Acceptance Criteria y su verificación,
numerados de forma correlativa (la numeración sigue en EP2). Revisar ese
índice antes de tocar el dashboard, para no duplicar algo ya resuelto ahí.

## Arquitectura y decisiones técnicas

Ver [`CLAUDE.md`](CLAUDE.md) para el detalle completo: configuración de
Azure, por qué se usa el idToken en vez del accessToken, el patrón de
lectura de roles tras un F5, y la pauta de evaluación de EP1.
