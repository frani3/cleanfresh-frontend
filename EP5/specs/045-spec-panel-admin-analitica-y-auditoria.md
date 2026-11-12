---
id: 045
type: spec
status: verified
---

# Spec 045 — Panel Admin con analítica y auditoría reales (desde Kafka)

## Qué debe hacer

Las pestañas "Analítica por sucursal" y "Registro de auditoría" del panel Admin mostraban datos **fijos escritos en el propio frontend** (`BRANCH_ACTIVITY` y
`AUDIT_LOG`), y `reportes` y `auditoria` eran esqueletos con respuesta fija. Con Kafka (Spec 044) pasan a ser reales:

- **`reportes`** calcula los reportes con los eventos de `orders.events`, sin consultar a `orders`:
  `GET /api/reportes` (pedidos por sucursal), `/kpis`, `/ventas-por-hora` y `/top-servicios`, todos con `?range=last1h|last24h|last7d|last30d`.
  Los KPIs son los del caso: **ventas**, **lead time** (tiempo entre crear y entregar) y **estados activos**.
- **`auditoria`** guarda la línea de tiempo (`audit.timeline`) y los eventos de negocio (`orders.events`): `GET /api/auditoria` (línea de tiempo paginada, con filtros por
  **usuario, tipo de evento, orden y rango de fechas**), `/ordenes/{numero}` (la historia completa de una orden: cada estado con quién lo hizo y desde dónde) y `/tipos`.
  Es **solo lectura**: no hay rutas para crear, cambiar ni borrar registros.
- El **BFF** las republica solo para el Admin, solo lectura y con lista blanca de rutas (`/api/reportes/**` y `/api/auditoria/**`).
- El **panel Admin** conecta sus dos pestañas a esos datos: **Analítica** (tarjetas de KPIs, estados activos, gráfico de ventas por hora o por día, servicios más
  pedidos y pedidos por sucursal, con selector de rango y refresco cada 15 s) y **Auditoría** (filtros, lista paginada y la historia de cada orden).

Definiciones: **ventas** = suma del total de los pedidos **no cancelados** creados en el rango; **lead time** = promedio, mínimo y máximo, en minutos, de los pedidos entregados;
**estados activos** = órdenes que hoy siguen en CREADO, ACEPTADO, EN_PREPARACION o DESPACHADO (sin importar cuándo se crearon).

## Fuera de alcance

- Registrar accesos denegados o cambios del catálogo (el catálogo es de solo lectura; no hay nada que auditar ahí).
- El rol "Auditor" del caso original: la auditoría es del Admin, como indica su pantalla.
- Cambiar RabbitMQ o los avisos.

## Acceptance Criteria

1. `reportes` calcula KPIs (pedidos, ventas, ticket promedio, entregados, cancelados, lead time y estados activos), ventas por hora, servicios más pedidos y pedidos por
   sucursal a partir de los eventos de Kafka, para los cuatro rangos; un rango desconocido responde 400.
2. `auditoria` devuelve la línea de tiempo del más reciente al más antiguo, paginada y filtrable por usuario, tipo, orden y fechas (desde incluido, hasta excluido; una
   fecha como `hasta` cubre ese día completo); `/ordenes/{numero}` devuelve la historia de la orden con quién y desde dónde; un filtro inválido responde 400, una orden sin
   registros 404 y cualquier intento de escribir 405.
3. El BFF reenvía `/api/reportes/**` y `/api/auditoria/**` solo al Admin (Operador y Cliente 403, sin token 401), solo por GET, solo las rutas conocidas (el resto 404) y devuelve el
   código del servicio tal cual (400, 404, 503).
4. El panel Admin muestra la analítica y la auditoría con los datos reales, sin ninguno fijo en el código; los reportes se actualizan solos y los filtros de la auditoría funcionan.
5. El frontend compila sin advertencias (`CI=true`) y su lógica pura tiene pruebas; los servicios y el BFF tienen sus pruebas en verde.

## Verificación

Salidas y capturas en [`../EVIDENCIA-EP5.md`](../EVIDENCIA-EP5.md), secciones 4 y 5.

| # | AC | Estado |
|---|---|---|
| 1 | Reportes con KPIs, ventas por hora, top y sucursales | ✅ Cumple: contra Kafka real, KPIs de 8 pedidos con ventas, lead time y estados activos coherentes; 11 pruebas del cálculo con "ahora" fijo (30 en total en `reportes`) |
| 2 | Auditoría con filtros, historia, 400, 404 y 405 | ✅ Cumple: filtros por usuario, tipo, orden y fechas probados en vivo; 13 pruebas del servicio y 9 del controlador (28 en total en `auditoria`) |
| 3 | BFF solo Admin, solo lectura, lista blanca | ✅ Cumple: 15 pruebas de `AdminRoutesTests` (401, 403, reenvío con su query string, 404 en rutas ajenas, 405 en escrituras, 400/404/503 del servicio tal cual); BFF 92 en total |
| 4 | Panel Admin con datos reales | ✅ Cumple en el navegador (Chrome, sesión Admin simulada y datos reales de los servicios por un proxy): analítica y auditoría con filtros e historia, ver capturas. Falta verlo con el login real de Cognito por API Gateway en AWS (Spec 047) |
| 5 | Compila sin advertencias y pruebas | ✅ Cumple: `CI=true npm run build` "Compiled successfully"; 46 pruebas de lógica pura del frontend (23 nuevas de `utils/reports`) |
