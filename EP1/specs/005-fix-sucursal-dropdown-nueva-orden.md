---
id: 005
type: fix
status: verified
---

# Fix 005 — Sucursal como dropdown en "Nueva orden"

Corrige un detalle de la Spec 004.

## Qué estaba mal

En el modal "Nueva orden", el campo "Sucursal" es un input de texto libre
(así se había definido en la Spec 004, AC9). Esto permite escribir
cualquier valor, incluso una sucursal que no existe o con errores de
tipeo, a diferencia del modal "Ver/Editar" donde sucursal ya es un
dropdown con las sucursales existentes (`BRANCHES`).

## Comportamiento correcto esperado

El campo "Sucursal" en "Nueva orden" pasa a ser un selector (`<select>`)
con las mismas opciones de `BRANCHES` que ya usa el modal "Ver/Editar",
en vez de texto libre.

## Acceptance Criteria

1. El campo "Sucursal" del modal "Nueva orden" es un `<select>` con las
   sucursales de `BRANCHES` (Providencia, Ñuñoa, Las Condes, Maipú).
2. Al abrir el modal, el selector tiene una sucursal preseleccionada por
   defecto (no queda vacío).
3. No es posible crear una orden con una sucursal fuera de esa lista.
4. El resto del formulario (cliente texto libre, servicio dropdown, precio
   autocompletado no editable) no cambia.
