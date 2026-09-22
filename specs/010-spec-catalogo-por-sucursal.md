---
id: 010
type: spec
status: verified
---

# Spec 010 — Catálogo por sucursal (Admin)

## Qué debe hacer

Hoy un servicio del catálogo es un único registro global: "disponible" o
"no disponible" para toda la app por igual. Pasa a poder configurarse
**por sucursal**: un servicio puede crearse para algunas sucursales
específicas, y deshabilitarse/habilitarse en cada sucursal de forma
independiente (ej: "Servicio exprés" disponible en Providencia pero no en
Maipú).

Este cambio es **solo para Admin** (según lo acordado): Operador y
Cliente siguen viendo el catálogo tal como hoy, sin filtrar por sucursal.

## Modelo de datos

Cada servicio reemplaza el campo `available: boolean` por
`branches: { [nombreSucursal]: boolean }`, con una entrada por cada
sucursal de `BRANCHES`. Al crear un servicio nuevo, todas las sucursales
arrancan habilitadas por defecto (se pueden desmarcar).

## Acceptance Criteria

1. El formulario de alta/edición de servicio (`ServiceFormModal`) agrega
   una casilla por cada sucursal de `BRANCHES`, para marcar en cuáles está
   disponible ese servicio. Al crear uno nuevo, todas empiezan marcadas.
2. La tarjeta "Catálogo" (Admin) agrega un selector de sucursal. Al elegir
   una sucursal, el botón de habilitar/deshabilitar de cada fila actúa
   sobre la disponibilidad de esa sucursal específica (no global).
3. Cada fila del catálogo muestra cuántas sucursales lo tienen habilitado
   (ej. "3/4 sucursales") además del estado para la sucursal actualmente
   seleccionada en el filtro.
4. El botón "Eliminar" (Spec 002) sigue eliminando el servicio por
   completo, de todas las sucursales a la vez — no cambia.
5. En Operador y Cliente, un servicio se sigue mostrando como
   "Disponible" mientras esté habilitado en **al menos una** sucursal, y
   "No disponible" solo si está deshabilitado en todas — sin agregar un
   selector de sucursal a esas vistas.
6. En los modales de "Nueva orden" y "Ver/Editar orden" (Spec 004), el
   selector de servicio se filtra según la sucursal elegida en ese mismo
   formulario: solo aparecen los servicios habilitados para esa sucursal.
   Si se cambia la sucursal del formulario y el servicio elegido ya no
   está disponible ahí, se selecciona automáticamente el primer servicio
   válido para la nueva sucursal.
7. Los datos mock (`SEED_SERVICES`) quedan con una combinación variada:
   al menos un servicio deshabilitado en alguna sucursal específica (para
   poder probar el caso), y el resto disponibles en todas.
