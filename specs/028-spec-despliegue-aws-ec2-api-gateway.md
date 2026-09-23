---
id: 028
type: spec
status: verified
---

# Spec 028 — Despliegue en AWS: BFF y microservicios en EC2 detrás de API Gateway

## Qué debe hacer

Sacar el backend de `localhost` y ponerlo accesible desde AWS, con API
Gateway como intermediario entre el frontend y el BFF, validando el
JWT de Cognito antes de reenviar cualquier petición.

**a) 3 instancias EC2** (`us-east-1`, Amazon Linux 2023, Java 21
Corretto), una por servicio — no una sola compartida:

| Servicio | IP pública | Puerto |
|---|---|---|
| `ms-cleanfresh-bff` | `13.222.150.67` | 8080 |
| `ms-cleanfresh-orders` | `3.86.143.171` | 8081 |
| `ms-cleanfresh-catalog` | `44.203.57.139` | 8082 |

El BFF corre con `ORDERS_SERVICE_URL`/`CATALOG_SERVICE_URL` apuntando
a las IPs públicas de las otras dos (en vez del `localhost` que usa en
desarrollo), además de `COGNITO_ISSUER_URI`/`COGNITO_CLIENT_ID` de
siempre.

**b) API Gateway** (`cleanfresh-api`, HTTP API, id `hucylsdii5`):
- Ruta `ANY /{proxy+}` → integración HTTP hacia
  `http://13.222.150.67:8080/{proxy}` (el BFF), con un **JWT
  Authorizer** (`cognito-authorizer`) atado: issuer = User Pool de
  Cognito, audience = client id del frontend. Rechaza sin token o con
  token inválido antes de llegar al BFF.
- Ruta `OPTIONS /{proxy+}` → misma integración, **sin** authorizer
  (el preflight de CORS no manda token — si tuviera el authorizer
  atado, el navegador nunca podría ni intentar la llamada real).

**c) CORS**: resuelto por el **BFF** (su `CorsConfigurationSource` ya
existente), no por API Gateway. Se intentó primero con el CORS nativo
de API Gateway (el tab "CORS" de la consola), pero API Gateway
descarta los headers CORS que devuelve el backend en cuanto el CORS
del API está configurado ("API Gateway ignores CORS headers returned
from your backend integration") — y no los reemplazaba por completo
en la ruta `OPTIONS` con integración propia, dejando la respuesta sin
ningún header CORS. Se resolvió borrando la config de CORS a nivel
API y dejando que la ruta `OPTIONS` (sin authorizer, con integración
al BFF) reenvíe al BFF, que sí arma la respuesta de preflight completa
él solo.

**d) Frontend**: `REACT_APP_BFF_URL` en `.env` apunta a la Invoke URL
de API Gateway (`https://hucylsdii5.execute-api.us-east-1.amazonaws.com/api`)
en vez de `http://localhost:8080/api`. Sin cambios de código — ya
estaba preparado para esto (`bffApiUrl` en `authConfig.js`).

## Nota de alcance

El frontend sigue corriendo en `localhost:3000` — no se pidió
desplegarlo a AWS en este ítem, solo que hable con un backend real en
la nube. Cognito tampoco cambió (ya existía).

Estas 3 EC2 y la API Gateway son recursos reales de la cuenta de AWS
del usuario, con costo asociado — quedan pendientes de apagar/eliminar
después de la evaluación si no se van a seguir usando.

## Acceptance Criteria

1. Las 3 instancias EC2 responden a sus endpoints públicos
   directamente (sin pasar por API Gateway).
2. El BFF en su EC2 llega a los otros dos microservicios usando sus
   IPs públicas (no `localhost`).
3. API Gateway reenvía correctamente al BFF (`ANY /{proxy+}`).
4. Sin token → 401 (lo frena API Gateway, antes de llegar al BFF).
5. Con token de firma/issuer inválido → 401.
6. Con token real y válido → 200 y el JSON esperado del microservicio
   correspondiente.
7. El preflight CORS (`OPTIONS`) responde 200 con los headers
   `Access-Control-Allow-*` correctos, sin pedir token.
8. El frontend (local) apuntando a la URL de API Gateway funciona
   igual que apuntando a `localhost:8080` — confirmado con los 3 roles
   (Admin, Operador, Cliente) mostrando su vista correspondiente.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | `curl` directo a cada IP:puerto → responde JSON | ✅ Cumple |
| 2 | BFF configurado con `ORDERS_SERVICE_URL`/`CATALOG_SERVICE_URL` hacia las IPs públicas; probado indirectamente vía AC4-6 (si no llegara, esas pruebas fallarían con 502/504, no 401/200) | ✅ Cumple |
| 3 | `curl` a la Invoke URL de API Gateway → llega al BFF (confirmado por el 401 de Spring antes de agregar el Authorizer) | ✅ Cumple |
| 4 | Probado en vivo: `curl` sin token → `401` de API Gateway (`{"message":"Unauthorized"}`, distinto formato al 401 de Spring) | ✅ Cumple |
| 5 | No se probó explícitamente un token con firma inválida contra este despliegue (sí se probó contra el BFF directo en la Spec 026/027) | ⚠️ No repetido en este entorno |
| 6 | Probado en vivo desde el navegador: catálogo/órdenes cargando datos reales a través de API Gateway | ✅ Cumple |
| 7 | Probado en vivo con `curl -X OPTIONS`: `200` con `access-control-allow-origin`, `-methods`, `-headers`, `-credentials` presentes | ✅ Cumple |
| 8 | Probado en vivo: login y vista correcta confirmados con Admin, Operador y Cliente, los 3 contra este despliegue | ✅ Cumple |

Verificado en vivo de punta a punta (no solo por configuración) el
23/09/2026: las 3 EC2, la API Gateway, el Authorizer JWT, el CORS, y
los 3 roles.
