---
id: 002
type: spec
status: verified
---

# Spec 002 — Catálogo: eliminar definitivo + tiempo de entrega limitado

Extiende la Spec 001 (CRUD de Catálogo) con dos mejoras.

## Qué debe hacer

**a) Eliminar servicio (definitivo):** además del botón de
desactivar/reactivar que ya existe (soft delete, Spec 001 AC7), se agrega un
botón "Eliminar" por servicio que lo borra por completo de la lista, previa
confirmación.

**b) Tiempo de entrega limitado:** en el formulario de alta/edición de
servicio, el campo "tiempo de entrega" deja de ser texto libre y pasa a ser
un selector con opciones fijas: **4h, 12h, 24h, 48h, 72h**.

## Acceptance Criteria

1. Cada fila del catálogo (vista Admin) tiene, además de "Editar" y
   "Desactivar/Reactivar", un botón "Eliminar".
2. Al presionar "Eliminar" se pide confirmación antes de borrar. Si se
   cancela esa confirmación, el servicio no se modifica ni se borra.
3. Al confirmar, el servicio desaparece por completo de la lista de
   catálogo en las tres vistas (Admin, Operador, Cliente) — a diferencia de
   desactivar, aquí no queda ni marcado como "no disponible": se va de la
   lista.
4. El formulario de alta/edición reemplaza el input de texto libre de
   "tiempo de entrega" por un selector (`<select>`) con las opciones fijas:
   4h, 12h, 24h, 48h, 72h.
5. Al editar un servicio existente, el selector muestra preseleccionado su
   tiempo de entrega actual (si coincide con una opción válida).
6. No es posible enviar el formulario sin un tiempo de entrega seleccionado
   (el selector siempre tiene un valor por defecto).
7. Las validaciones de nombre y precio de la Spec 001 (AC3, AC6) se
   mantienen sin cambios.
