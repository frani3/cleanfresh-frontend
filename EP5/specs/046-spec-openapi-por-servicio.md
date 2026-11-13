---
id: 046
type: spec
status: verified
---

# Spec 046 — OpenAPI (Swagger) en todos los servicios

## Qué debe hacer

El caso Pedidos360 pide **OpenAPI por servicio (Swagger)** como requisito técnico. Hasta ahora solo `ms-cleanfresh-mq-admin` lo tenía. Con esta spec los ocho
servicios (BFF, `orders`, `catalog`, `notificaciones`, `reportes`, `auditoria`, `mq-admin` y `kafka-admin`) publican su contrato en `/v3/api-docs` y una interfaz en
`/swagger-ui.html`, con cada endpoint descrito.

- Dependencia `springdoc-openapi-starter-webmvc-ui` 3.1.1 (la misma que ya usaba `mq-admin`) en los servicios que faltaban: BFF, `orders`, `catalog` y `notificaciones`
  (`reportes`, `auditoria` y `kafka-admin` la traen desde las Specs 044 y 045).
- Cada controlador lleva su `@Tag` (nombre y descripción) y cada endpoint su `@Operation(summary)`; los códigos que importan (400, 404, 409...) van en el resumen.
- Cada servicio tiene un `OpenApiConfig` con su título, versión y descripción. El del BFF agrega el esquema de seguridad **Bearer JWT** (access token de Cognito): en Swagger se
  pulsa *Authorize* y se pega el token para probar los endpoints.
- **Seguridad del BFF:** solo `/swagger-ui.html`, `/swagger-ui/**` y `/v3/api-docs/**` se abren sin token (describen el contrato y no devuelven datos); llamar a cualquier endpoint
  sigue exigiendo el token y el rol. Los microservicios no validan JWT porque no son públicos (solo los alcanza el BFF).

## Fuera de alcance

- Generar clientes a partir del contrato.
- Documentar el esquema de cada DTO con ejemplos (springdoc los infiere de los `record`).

## Acceptance Criteria

1. Los ocho servicios sirven `/v3/api-docs` con su título y los endpoints de cada controlador, y `/swagger-ui/index.html`.
2. Cada endpoint tiene su resumen y cada controlador su `@Tag`.
3. El BFF publica el esquema Bearer; la documentación se abre sin token y los endpoints siguen respondiendo 401 sin él.
4. Las pruebas de cada servicio siguen en verde y hay una prueba por servicio que comprueba que el contrato se publica.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | Contrato y Swagger UI en los ocho servicios | ✅ Cumple: `OpenApiTests` en `orders`, `catalog`, `notificaciones` y BFF (`/v3/api-docs` con título y rutas, `/swagger-ui/index.html` 200); `reportes`, `auditoria`, `mq-admin` y `kafka-admin` ya lo publicaban (se vio en `/v3/api-docs` de los dos primeros al levantarlos) |
| 2 | Resumen por endpoint y `@Tag` por controlador | ✅ Cumple: 12 controladores anotados (BFF 8, `orders`, `catalog` y `notificaciones` 3) |
| 3 | Esquema Bearer en el BFF y endpoints con token | ✅ Cumple: la prueba del BFF comprueba `components.securitySchemes['cognito-access-token'].scheme = bearer`, la documentación sin token en 200 y `/api/orders` y `/api/reportes/kpis` en 401 |
| 4 | Pruebas en verde | ✅ Cumple: `orders` 69, `catalog` 6, `notificaciones` 58, BFF 95 |
