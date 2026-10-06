---
id: 019
type: spec
status: verified
---

# Spec 019 — Selector de sucursal para el Operador (demo de integración)

## Qué debe hacer

Hoy el Operador ve una sucursal fija, resuelta por el BFF desde un
mapeo email→sucursal (Spec 016) que el frontend no controla. Se agrega
un selector de sucursal en la vista Operador ("¿en qué sucursal estoy
hoy?"): al cambiarlo, se vuelve a pedir `GET /api/orders` al BFF con
esa sucursal, y el catálogo (que ya viaja completo con `sucursales` por
servicio) se muestra filtrado para esa sucursal — mismo patrón que ya
usa Admin en su tab de Catálogo (Spec 010).

Esto sirve para **demostrar en vivo** que los datos vienen del backend
real: cambiar de sucursal tiene que traer órdenes y disponibilidad de
catálogo distintas, no un filtro que ya estaba todo descargado de
antemano.

## Nota de seguridad (decisión consciente, no bug)

Con este cambio, el Operador puede elegir **cualquier** sucursal, no
solo la que le asigna el mapeo fijo del BFF. Es aceptable para esta
evaluación (datos mock, un solo usuario Operador de prueba), pero en un
sistema real sería un hueco: un operador viendo pedidos de un local
donde no trabaja. Si más adelante se agregan operadores reales por
sucursal, este selector debería reemplazarse por algo que solo muestre
las sucursales que ese usuario tiene realmente asignadas.

## Acceptance Criteria

1. La vista Operador tiene un selector de sucursal (mismas 4 opciones
   que el resto de la app).
2. Al cambiar la sucursal seleccionada, se vuelve a llamar
   `GET /api/orders` al BFF pasando esa sucursal (no es un filtro
   client-side sobre datos ya traídos).
3. El BFF acepta un parámetro de sucursal en `GET /api/orders` (y
   `/estado/{estado}`): si el que llama es Operador y el parámetro es
   una sucursal válida, se usa esa en vez del mapeo fijo; si no se
   manda el parámetro, se sigue usando el mapeo fijo como hasta ahora
   (no rompe la Spec 016).
4. Si el parámetro de sucursal no es uno de los 4 válidos, el BFF lo
   ignora y usa el mapeo fijo (no filtra por un valor arbitrario).
5. Para Admin, el parámetro no tiene efecto — sigue viendo todo.
6. El catálogo de la vista Operador (que ya viaja completo) pasa a
   mostrar disponible/no disponible según la sucursal seleccionada, en
   vez de "disponible en cualquier sucursal" como hasta ahora.
7. Las tarjetas de KPIs operativos (pendientes, exprés, en despacho) se
   recalculan solas con las nuevas órdenes — no necesitan cambios de
   código, ya se derivan de `orders`.
8. Cambiar de sucursal no afecta a `AdminView` ni a `ClienteView`.
