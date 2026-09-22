---
id: 012
type: spec
status: verified
---

# Spec 012 — Filtros de órdenes integrados en el módulo (sin modal)

Reemplaza el enfoque de la Spec 006/007 (botón "Ver todas las órdenes"
que abría un modal aparte, de solo lectura, con sus propios filtros).

## Qué debe hacer

Se quita el botón "Ver todas las órdenes" y el modal que abría
(`AllOrdersModal`). En su lugar, la pestaña "Órdenes recientes" (dentro
del sistema de tabs de la Spec 011) muestra **todas** las órdenes
directamente en su propia tabla (ya no se corta en las primeras 6), con
los filtros de búsqueda por cliente, estado y sucursal **integrados
arriba de la tabla del módulo**, no en un modal separado.

Como ahora todo vive en el mismo lugar, la tabla conserva la columna
"Acción" con el botón "Ver" (abre el modal "Ver/Editar" de la Spec 004)
en cada fila — a diferencia del modal anterior, que era de solo lectura.

## Acceptance Criteria

1. El botón "Ver todas las órdenes" ya no existe en la interfaz.
2. La tabla de la pestaña "Órdenes recientes" muestra **todas** las
   órdenes (sin límite de 6).
3. Arriba de la tabla hay tres filtros: búsqueda por cliente (texto,
   parcial, sin distinguir mayúsculas/minúsculas), estado (dropdown con
   "Todos") y sucursal (dropdown con "Todas las sucursales").
4. Los tres filtros se combinan entre sí (AND).
5. Si la combinación de filtros no da resultados, se muestra "Sin
   resultados" en vez de una tabla vacía.
6. Cada fila conserva el botón "Ver" que abre el modal "Ver/Editar" de
   esa orden (Spec 004), con todas sus funciones (editar, cambiar
   estado, eliminar) intactas.
7. El botón "Nueva orden" se mantiene, en el mismo lugar que hoy.
8. Los filtros no afectan a `OperadorView` ni a `ClienteView`.
9. El componente `AllOrdersModal` deja de usarse (se elimina del código,
   no queda como código muerto).
