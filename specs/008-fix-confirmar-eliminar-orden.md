---
id: 008
type: fix
status: verified
---

# Fix 008 — Confirmación de eliminar orden por N° de orden

## Qué estaba mal

Al eliminar una orden desde el modal "Ver/Editar" (Spec 004, AC7), la
confirmación es un `window.confirm` nativo (Aceptar/Cancelar). Es fácil de
confirmar sin darse cuenta con un solo click accidental.

## Comportamiento correcto esperado

Al presionar "Eliminar orden", en vez del diálogo nativo, el modal muestra
un paso de confirmación con un campo de texto: hay que escribir el N° de
la orden exacto (ej. "ORD-2041") para habilitar el botón de confirmación
definitiva.

Este cambio aplica **solo** a eliminar órdenes. Eliminar un servicio del
catálogo (Spec 002) no cambia, sigue con el `window.confirm` simple.

## Acceptance Criteria

1. Al presionar "Eliminar orden" dentro del modal "Ver/Editar", se muestra
   un paso de confirmación con un campo de texto y una advertencia
   indicando que hay que escribir el N° de la orden.
2. El botón de confirmación definitiva está deshabilitado hasta que el
   texto ingresado coincida exactamente con el N° de la orden.
3. Al escribir el N° correcto y confirmar, la orden se elimina de la lista
   y el modal se cierra.
4. Hay una forma de cancelar este paso (volver al formulario de edición)
   sin eliminar la orden.
5. La eliminación de servicios de catálogo (Spec 002) no se modifica.
