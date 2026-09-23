# Índice de specs y fixes — Vista Admin

Este proyecto usa una metodología manual de **Spec-Driven Development
(SDD)**: cada funcionalidad nueva (spec) o corrección de algo que ya
existía (fix) se documenta acá antes de programarse, con sus Acceptance
Criteria (ACs). El flujo completo por cada ítem es:

1. **Spec/Fix** — qué debe hacer (o qué estaba mal) + lista de ACs
   verificables.
2. **Plan** — archivos a tocar y enfoque técnico, mostrado antes de
   escribir código.
3. **Implementación** — recién ahí se programa.
4. **Verificación** — se revisa cada AC uno por uno y se marca si se
   cumplió o no.

Specs y fixes comparten una **numeración única** (no hay un "Spec 003" y
un "Fix 003" por separado): el número identifica el ítem sin ambigüedad,
sin importar el tipo.

> Nota: las fechas exactas de cada ítem no quedaron registradas de forma
> individual durante la sesión de trabajo; todos corresponden a la
> implementación del panel Admin del dashboard bento.

## Índice

| # | Tipo | Título | Estado | Archivo |
|---|------|--------|--------|---------|
| 001 | Spec | CRUD de Catálogo de servicios (vista Admin) | ✅ Verificado | [001-spec-catalogo-crud.md](001-spec-catalogo-crud.md) |
| 002 | Spec | Catálogo: eliminar definitivo + tiempo de entrega limitado | ✅ Verificado | [002-spec-catalogo-eliminar-y-eta.md](002-spec-catalogo-eliminar-y-eta.md) |
| 003 | Fix | Moneda global CLP | ✅ Verificado | [003-fix-moneda-clp.md](003-fix-moneda-clp.md) |
| 004 | Spec | CRUD de Órdenes recientes + modal "Ver / Editar" | ✅ Verificado | [004-spec-crud-ordenes-modal-ver.md](004-spec-crud-ordenes-modal-ver.md) |
| 005 | Fix | Sucursal como dropdown en "Nueva orden" | ✅ Verificado | [005-fix-sucursal-dropdown-nueva-orden.md](005-fix-sucursal-dropdown-nueva-orden.md) |
| 006 | Spec | Botón "Ver todas las órdenes" | 🔄 Superada por 012 | [006-spec-ver-todas-las-ordenes.md](006-spec-ver-todas-las-ordenes.md) |
| 007 | Spec | Filtro por sucursal en "Ver todas las órdenes" | 🔄 Superada por 012 | [007-spec-filtro-sucursal-ver-todas.md](007-spec-filtro-sucursal-ver-todas.md) |
| 008 | Fix | Confirmación de eliminar orden por N° de orden | ✅ Verificado | [008-fix-confirmar-eliminar-orden.md](008-fix-confirmar-eliminar-orden.md) |
| 009 | Fix | Español neutro (sucursales chilenas + voseo) | ✅ Verificado | [009-fix-espanol-neutro.md](009-fix-espanol-neutro.md) |
| 010 | Spec | Catálogo por sucursal (Admin) | ✅ Verificado | [010-spec-catalogo-por-sucursal.md](010-spec-catalogo-por-sucursal.md) |
| 011 | Spec | Pestañas para módulos secundarios de Admin | ✅ Verificado | [011-spec-tabs-admin.md](011-spec-tabs-admin.md) |
| 012 | Spec | Filtros de órdenes integrados en el módulo (sin modal) | ✅ Verificado | [012-spec-ordenes-filtros-integrados.md](012-spec-ordenes-filtros-integrados.md) |
| 013 | Spec | Interceptor de axios + AuthGuard explícito | ✅ Verificado | [013-spec-interceptor-y-guard.md](013-spec-interceptor-y-guard.md) |
| 014 | Fix | Interceptor sin fallback de cuenta activa | ✅ Verificado | [014-fix-interceptor-fallback-cuenta.md](014-fix-interceptor-fallback-cuenta.md) |
| 015 | Spec | Sucursales en `ms-catalog` (+ DTO del BFF) | ✅ Verificado | [015-spec-sucursales-ms-catalog.md](015-spec-sucursales-ms-catalog.md) |
| 016 | Spec | Sucursal en `ms-orders` + filtro por rol en el BFF | ✅ Verificado | [016-spec-sucursal-ms-orders-filtro-bff.md](016-spec-sucursal-ms-orders-filtro-bff.md) |
| 017 | Spec | Conectar el frontend a catálogo y órdenes reales (GET) | ✅ Verificado | [017-spec-conectar-frontend-catalogo-ordenes.md](017-spec-conectar-frontend-catalogo-ordenes.md) |
| 018 | Fix | Precio de `ms-catalog` en miles en vez de pesos completos | ✅ Verificado | [018-fix-precio-catalogo-miles.md](018-fix-precio-catalogo-miles.md) |
| 019 | Spec | Selector de sucursal para el Operador (demo de integración) | ✅ Verificado | [019-spec-selector-sucursal-operador.md](019-spec-selector-sucursal-operador.md) |
| 020 | Spec | Historial de estados por orden + Cliente conectado a órdenes reales | 📝 Draft (implementado, sin marcar) | [020-spec-historial-estados-orden.md](020-spec-historial-estados-orden.md) |
| 021 | Spec | Operador puede marcar disponibilidad de servicios en su sucursal (Catálogo) | ✅ Verificado | [021-spec-operador-disponibilidad-catalogo.md](021-spec-operador-disponibilidad-catalogo.md) |
| 022 | Fix | Reemplazar `window.confirm` nativo por un modal de confirmación propio | ✅ Verificado | [022-fix-reemplazar-window-confirm.md](022-fix-reemplazar-window-confirm.md) |
| 023 | Fix | Buscador de "Órdenes recientes" (Admin) también busca por N° de orden | ✅ Verificado | [023-fix-buscador-ordenes-admin-por-numero.md](023-fix-buscador-ordenes-admin-por-numero.md) |
| 024 | Spec | Cliente ve solo sus propios pedidos + puede solicitar servicios | ✅ Verificado | [024-spec-cliente-filtro-y-solicitar.md](024-spec-cliente-filtro-y-solicitar.md) |
| 025 | Spec | Pedido real: Cliente crea la orden en el backend (POST), visible para Operador/Admin | ✅ Verificado | [025-spec-pedido-real-cliente-post.md](025-spec-pedido-real-cliente-post.md) |
| 026 | Spec | Migración de MSAL/Azure a AWS Cognito (frontend + BFF) | ✅ Verificado en vivo (ver Fix 027) | [026-spec-migracion-cognito.md](026-spec-migracion-cognito.md) |
| 027 | Fix | Validar scope en el BFF + fixes en vivo de la migración a Cognito | ✅ Verificado en vivo | [027-fix-validar-scope-y-fixes-cognito-en-vivo.md](027-fix-validar-scope-y-fixes-cognito-en-vivo.md) |

## Ítems superados (superseded)

| # | Reemplazado por | Motivo |
|---|---|---|
| 006 | Spec 012 | El botón "Ver todas las órdenes" + su modal se eliminaron; la Spec 012 integró el listado completo y los filtros directamente en el módulo "Órdenes recientes". |
| 007 | Spec 012 | Filtro de sucursal del modal "Ver todas" (Spec 006) eliminado junto con este; reemplazado por el filtro de sucursal integrado de la Spec 012. |
| 020 (AC8-9) | Spec 024 | "Mis pedidos"/"Pedidos" ya no muestra todas las órdenes sin filtrar; ahora filtra de verdad por cliente logueado (con la limitación de alcance que documenta la propia Spec 024). |

## Integración con backend (Specs 013–019, 025)

Las Specs 013–019 conectan el frontend a `ms-cleanfresh-orders` y
`ms-cleanfresh-catalog` a través del BFF, originalmente en alcance
**solo lectura** (sin DB cloud todavía — ver `CLAUDE.md` → Pendientes).
De paso corrigieron dos desajustes preexistentes entre los DTOs del BFF
y los contratos reales de los microservicios (Specs 015 y 016), que
hubieran roto la integración silenciosamente.

La Spec 025 agrega la primera escritura real: `POST /api/orders`
(Cliente solicita un servicio), para que un pedido creado en una
sesión sea visible desde otra (Operador/Admin) — el resto del CRUD
sigue siendo client-side mock, como estaba.

## Migración a Cognito (Spec 026)

El proveedor de identidad cambió de MSAL/Azure a AWS Cognito —
frontend y BFF migrados juntos. **No probado en vivo** (sin acceso a
AWS desde este entorno): ver la sección "Pendiente de verificación"
al final de la Spec 026 para la lista concreta de cosas a confirmar
contra el User Pool real antes de dar esto por cerrado (nombres de los
grupos de Cognito, el `username` real del Operador de prueba, y la
configuración del App Client).

## Pendiente de verificación visual

Varios ítems tienen ACs sobre comportamiento responsive (`≤480px`) que se
verificaron por lectura de CSS, no en un navegador real (no hay entorno
gráfico disponible durante estas sesiones). Antes de dar el módulo por
cerrado para la entrega, conviene probar a mano:

- Modales de catálogo y órdenes en un viewport de mobile.
- El filtro de sucursal en Catálogo y el auto-cambio de servicio al
  cambiar de sucursal en los modales de orden.

## Convención de archivos

- Nombre: `NNN-spec-slug.md` o `NNN-fix-slug.md`, `NNN` con 3 dígitos.
- Frontmatter al inicio de cada archivo:
  ```yaml
  ---
  id: 004
  type: spec   # spec | fix
  status: verified   # draft | approved | implemented | verified | superseded
  ---
  ```
- Las referencias cruzadas entre archivos dicen "Spec NNN" / "Fix NNN"
  (nunca solo el número) para que sean inequívocas incluso si se leen
  fuera de contexto.
- Para crear una spec o fix nueva, copiá [`_template.md`](_template.md)
  (no está numerado ni aparece en la tabla — es solo el esqueleto).
