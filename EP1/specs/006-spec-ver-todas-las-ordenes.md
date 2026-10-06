---
id: 006
type: spec
status: superseded
---

# Spec 006 — Botón "Ver todas las órdenes" (T3)

Cubre el punto 6 del pedido original: la tabla "Órdenes recientes" de Admin
solo muestra las primeras 6 órdenes, sin forma de ver el resto.

## Qué debe hacer

En la tarjeta "Órdenes recientes" (Admin) se agrega un botón "Ver todas
las órdenes" que abre un modal responsive con el listado **completo** de
órdenes (no solo las 6 recientes), con un buscador por cliente y un filtro
por estado. Es de solo lectura: no permite editar ni eliminar desde aquí —
para eso se sigue usando el botón "Ver" de la tabla de recientes (Spec
004).

## Acceptance Criteria

1. Hay un botón "Ver todas las órdenes" visible en la tarjeta "Órdenes
   recientes".
2. Al presionar, se abre un modal con una tabla que lista **todas** las
   órdenes (no solo las primeras 6).
3. El modal tiene un campo de búsqueda por texto que filtra por nombre de
   cliente (sin distinguir mayúsculas/minúsculas, coincidencia parcial).
4. El modal tiene un selector de estado (con opción "Todos") que filtra
   las órdenes por estado.
5. Los dos filtros se pueden combinar: buscar por cliente y filtrar por
   estado a la vez muestra solo las órdenes que cumplen ambas condiciones.
6. Si ningún resultado matchea los filtros, se muestra un mensaje "Sin
   resultados" en vez de una tabla vacía.
7. La tabla de este modal refleja los mismos datos que "Órdenes recientes"
   (si se crea, edita o elimina una orden, se ve reflejado aquí también).
8. Las filas de esta tabla no tienen botón de acción (es de solo lectura).
9. El modal es responsive: usable en desktop y mobile (≤480px), con scroll
   interno si la lista es larga.
10. Cerrar el modal no aplica ningún cambio.
