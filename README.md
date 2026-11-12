# Clean&Fresh Manager — Frontend

Frontend en React (Create React App, JavaScript) del sistema de gestión de la cadena de lavanderías Clean&Fresh. Proyecto
individual de **DSY1107 Cloud Native 1** (DuocUC), evaluaciones parciales **EP1** y **EP2**.

Es un dashboard de una sola pantalla ("bento grid") que cambia de vista según el rol del usuario (Admin / Operador / Cliente),
leído del token de **AWS Cognito**. Habla solo con un **BFF** (Spring Boot), que a su vez consulta los microservicios; los avisos
entre servicios viajan por un clúster **RabbitMQ**.

## Stack

- React 19 (Create React App, JavaScript — sin TypeScript)
- `oidc-client-ts` y `react-oidc-context` (login con Cognito, Authorization Code + PKCE)
- Axios, con un interceptor que adjunta el access token en cada llamada al BFF
- Lucide (íconos)

## Requisitos

- Node.js 18 o superior
- El BFF y los microservicios accesibles: en AWS (lo usual) o en local (ver los README de cada servicio)

## Configuración

Crear un archivo `.env` en la raíz (no se sube a git) con estas variables; los valores reales están en la sección
"Variables de Entorno" de [`CLAUDE.md`](CLAUDE.md):

```
REACT_APP_COGNITO_AUTHORITY=<issuer del User Pool>
REACT_APP_COGNITO_CLIENT_ID=<client id del App Client>
REACT_APP_COGNITO_DOMAIN=<dominio del Hosted UI>
REACT_APP_API_SCOPE=<scope de la API>
REACT_APP_BFF_URL=<URL del BFF o de API Gateway, terminada en /api>
```

El App Client de Cognito debe tener registrada la URL de retorno exacta `http://localhost:3000/` (con la barra final).

## Levantar en local

```bash
npm install
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Los usuarios de prueba (uno por rol) existen en el User Pool; sus
contraseñas no se documentan.

## Scripts

- `npm start` — modo desarrollo
- `npm run build` — build de producción
- `npm test` — pruebas

## Estructura

```
src/
├── authConfig.js        # Configuración de Cognito y UserManager compartido
├── index.js             # AuthProvider (react-oidc-context)
├── App.jsx              # AuthGuard + Navbar + BentoDashboard
├── components/          # AuthGuard, Navbar, campanita y módulo de notificaciones, filtros de órdenes
├── hooks/               # useNotifications, useOrderFilters
├── pages/BentoDashboard.jsx   # Dashboard único, cambia de vista según el rol
├── services/apiService.js     # Cliente axios + interceptor de autenticación hacia el BFF
└── utils/               # Lógica pura (avisos, órdenes) con sus pruebas
```

## Documentación

| Dónde | Qué hay |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Contexto completo del proyecto: stack, Cognito, AWS, roles, decisiones técnicas y pendientes |
| [`EP2/README.md`](EP2/README.md) | **Índice de la entrega 2**: arquitectura, despliegue, operación, demostraciones de RabbitMQ, evidencia y specs |
| [`EP5/README.md`](EP5/README.md) | **Índice de la entrega 5**: Kafka (Zookeeper, brokers, Kafka-UI), specs 044 en adelante y evidencia |
| [`EP1/`](EP1/) | Entrega 1 (cerrada): specs 001–028, evidencia y explicaciones de Cognito y del BFF |

Los cambios funcionales se documentan con Spec-Driven Development manual: cada spec o fix tiene sus Acceptance Criteria y su
verificación, con una numeración única que continúa entre entregas (índices en [`EP1/specs/README.md`](EP1/specs/README.md) y
[`EP2/specs/README.md`](EP2/specs/README.md)). Conviene revisarlos antes de tocar algo que ya está resuelto.

## Repositorios del sistema

| Repositorio | Qué es |
|---|---|
| [cleanfresh-frontend](https://github.com/frani3/cleanfresh-frontend) | Este frontend, la documentación y los scripts de despliegue |
| [ms-cleanfresh-bff](https://github.com/frani3/ms-cleanfresh-bff) | BFF: valida el JWT y aplica los roles |
| [ms-cleanfresh-orders](https://github.com/frani3/ms-cleanfresh-orders) | Órdenes (PostgreSQL); publica los comandos a RabbitMQ |
| [ms-cleanfresh-catalog](https://github.com/frani3/ms-cleanfresh-catalog) | Catálogo de servicios por sucursal |
| [ms-cleanfresh-notificaciones](https://github.com/frani3/ms-cleanfresh-notificaciones) | Consume RabbitMQ: avisos, tickets, boletas y mensajes muertos |
| [ms-cleanfresh-reportes](https://github.com/frani3/ms-cleanfresh-reportes) | Reportes (esqueleto) |
| [ms-cleanfresh-auditoria](https://github.com/frani3/ms-cleanfresh-auditoria) | Auditoría (esqueleto) |
| [ms-cleanfresh-mq-admin](https://github.com/frani3/ms-cleanfresh-mq-admin) | Administra RabbitMQ (solo Admin, vía BFF) |
