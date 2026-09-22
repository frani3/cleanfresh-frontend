---
id: 001
type: spec
status: verified
---

# Spec 001 — CRUD de Catálogo de servicios (vista Admin)

## Qué debe hacer

En la vista Admin, la tarjeta "Catálogo" (hoy es una lista de solo lectura con
nombre y precio) pasa a permitir gestionar los servicios de la lavandería:
crear un servicio nuevo, editar uno existente y desactivarlo (no se borra,
queda marcado como no disponible). Cada servicio tiene tres datos editables:
**nombre**, **precio** y **tiempo de entrega**.

Todo esto opera sobre el estado en memoria del componente (mock), sin
conectar a un backend todavía — según lo acordado.

## Acceptance Criteria

1. En la tarjeta "Catálogo" de la vista Admin hay un botón "Nuevo servicio"
   visible en todo momento.
2. Al hacer clic en "Nuevo servicio" se abre un modal con un formulario con
   tres campos: nombre (texto), precio (numérico) y tiempo de entrega
   (texto, ej. "24h").
3. Si se intenta guardar el formulario de alta con el nombre vacío o el
   precio vacío/negativo/no numérico, se muestra un error y no se crea el
   servicio.
4. Al guardar un alta válida, el nuevo servicio aparece inmediatamente en la
   lista del catálogo, marcado como disponible, y el modal se cierra.
5. Cada servicio de la lista tiene un botón "Editar" que abre el mismo modal
   con el formulario pre-cargado con sus datos actuales.
6. Al guardar una edición válida, los cambios se reflejan inmediatamente en
   la lista y el modal se cierra. Las mismas validaciones del punto 3 aplican
   aquí.
7. Cada servicio tiene un botón para desactivarlo/reactivarlo (soft delete):
   - Un servicio desactivado sigue visible en la lista del catálogo de Admin,
     pero visualmente marcado como "No disponible".
   - Un servicio desactivado en el catálogo de Admin también aparece como no
     disponible en las vistas de Operador y Cliente (reutilizan el mismo
     estado de servicios).
   - El botón permite reactivar un servicio previamente desactivado.
8. El modal de alta/edición es responsive: usable tanto en una ventana de
   escritorio como en un ancho de mobile (≤480px), sin que el formulario se
   corte o se salga de la pantalla.
9. Cancelar el modal (botón "Cancelar" o cerrarlo) no aplica ningún cambio a
   la lista de servicios.
