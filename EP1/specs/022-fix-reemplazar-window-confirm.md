---
id: 022
type: fix
status: verified
---

# Fix 022 — Reemplazar `window.confirm` nativo por un modal de confirmación propio

## Qué estaba mal

Tres flujos usaban `window.confirm(...)` del navegador para confirmar
una acción: cambiar el estado de una orden desde `OrderLifecycleModal`
(Spec 020 AC5), guardar cambios en el modal "Ver/Editar" de una orden
(Spec 004), y eliminar un servicio del catálogo (Spec 001). El diálogo
nativo ("localhost:3000 dice...") se ve fuera de estilo respecto al
resto de la UI y no es consistente entre vistas. La confirmación de
"Eliminar orden" (Fix 008) y la de "Eliminar servicio" en su momento
inicial ya usaban UI propia — este fix extiende ese mismo criterio a
todos los `window.confirm` restantes.

## Comportamiento correcto esperado

Un componente `ConfirmModal` reutilizable (mismo estilo que el resto de
los modales de la app: `Modal`/`modal-panel`/`modal-footer`) reemplaza
los tres `window.confirm` restantes:

1. `OrderLifecycleModal` → confirmar cambio de estado.
2. `OrderViewModal` → confirmar guardado de cambios de una orden.
3. Catálogo (Admin) → confirmar eliminación de un servicio.

## Acceptance Criteria

1. No queda ningún `window.confirm` en el código del frontend.
2. Cambiar el estado desde `OrderLifecycleModal` muestra `ConfirmModal`
   en vez del diálogo nativo; cancelar no aplica el cambio.
3. Guardar cambios desde el modal "Ver/Editar" de una orden (Admin)
   muestra `ConfirmModal`; cancelar vuelve al formulario sin perder lo
   editado.
4. Eliminar un servicio del catálogo (Admin) muestra `ConfirmModal`;
   cancelar no elimina nada.
5. El resto de confirmaciones que ya tenían UI propia (eliminar orden,
   Fix 008) no se modifican.
6. No rompe el resto del CRUD ni las specs anteriores.

## Verificación

| # | AC | Estado |
|---|---|---|
| 1 | `grep window.confirm` solo aparece en un comentario | ✅ Cumple |
| 2 | `OrderLifecycleModal` usa `confirmingChange` + `ConfirmModal` | ✅ Cumple |
| 3 | `OrderViewModal` usa `pendingSave` + `ConfirmModal`, cancelar limpia solo `pendingSave` | ✅ Cumple |
| 4 | Catálogo usa `deleteServiceTarget` + `ConfirmModal` | ✅ Cumple |
| 5 | Flujo de "Eliminar orden" (`confirmingDelete`) sin cambios | ✅ Cumple |
| 6 | Lint y `npm run build` sin errores | ✅ Cumple |

Verificado por lectura de código + build; pendiente de confirmación
visual en navegador (los 3 flujos, en las vistas Admin/Operador).
