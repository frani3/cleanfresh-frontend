---
id: 004
type: spec
status: verified
---

# Spec 004 — CRUD de Órdenes recientes + modal "Ver / Editar"

Cubre los puntos 2, 3, 4, 5 y 7 del pedido original (T2 del assignment):
el botón "Ver" de la tabla "Órdenes recientes" (Admin) hoy no hace nada;
pasa a abrir un modal responsive con el detalle de la orden, que permite
editarla (incluido el estado) o eliminarla. Además se agrega un botón
para crear una orden nueva.

## Qué debe hacer

**Ver / Editar (modal):** al presionar "Ver" en una fila de la tabla
"Órdenes recientes", se abre un modal con el detalle completo de esa orden
y un formulario de edición:

- **N° de orden**: solo lectura (no se puede cambiar).
- **Cliente**: editable, texto libre.
- **Sucursal**: editable, selector (dropdown) con las sucursales existentes.
- **Servicio**: editable, selector (dropdown) con los servicios del
  catálogo. Al cambiar el servicio, el precio se autocompleta con el precio
  de catálogo de ese servicio (sugerencia), pero sigue siendo editable.
- **Precio**: editable, numérico.
- **Estado**: editable, selector (dropdown) con los 5 estados del flujo
  (Creado, Aceptado, En preparación, Despachado, Entregado).

Antes de aplicar los cambios se pide una confirmación explícita. El modal
también tiene un botón "Eliminar orden" (con confirmación aparte) y es
responsive.

**Crear orden nueva:** un botón "Nueva orden" (en la tarjeta "Órdenes
recientes") abre un modal de alta con: cliente (texto libre), sucursal
(texto libre), servicio (dropdown de catálogo — el precio se autocompleta y
no es editable en el alta) y estado inicial fijo en "Creado". La fecha/hora
de creación se genera automáticamente.

## Acceptance Criteria

1. El botón "Ver" de cada fila de la tabla "Órdenes recientes" abre el
   modal de detalle de esa orden específica (hoy no hace nada).
2. El modal muestra el N° de orden como texto de solo lectura (no hay forma
   de editarlo desde la UI).
3. Los campos cliente, sucursal, servicio, precio y estado son editables
   como se describe arriba (texto, dropdown, dropdown, numérico, dropdown
   respectivamente).
4. Cambiar el servicio seleccionado actualiza el campo precio con el valor
   de catálogo de ese servicio, pero el usuario puede modificarlo después a
   mano.
5. Al intentar guardar cambios, se pide una confirmación explícita antes de
   aplicarlos; si se cancela esa confirmación, no se modifica la orden.
6. Al confirmar, los cambios (incluido un cambio de estado) se reflejan
   inmediatamente en la tabla de "Órdenes recientes" y el modal se cierra.
7. El modal tiene un botón "Eliminar orden" que, tras una confirmación
   aparte, saca la orden de la lista y cierra el modal. Si se cancela esa
   confirmación, la orden no se borra.
8. Hay un botón "Nueva orden" visible en la tarjeta "Órdenes recientes".
9. El formulario de alta pide cliente (texto), sucursal (texto) y servicio
   (dropdown de catálogo); el precio se autocompleta según el servicio
   elegido y no se puede editar a mano en el alta.
10. Una orden creada aparece inmediatamente en la tabla con estado "Creado"
    y una hora de creación generada automáticamente.
11. Si se intenta crear una orden sin cliente, sucursal o servicio
    seleccionados, se muestra un error y no se crea.
12. El modal (tanto "Ver/Editar" como "Nueva orden") es responsive: usable
    en desktop y en un ancho de mobile (≤480px) sin cortarse.
13. Cancelar cualquiera de los dos modales sin guardar no aplica ningún
    cambio.

## Fuera de alcance (queda para T3)

Un botón separado "Ver todas las órdenes" que abra un listado completo con
filtro — no es parte de esta spec.
